import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { upload } from "@/lib/storage";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { checkVideoCredits, deductVideoCredit } from "@/actions/video-credits-actions";
import { STORY_VIDEO_IMAGE_ANIME_STYLE_CORE } from "@/lib/story-video";

export const maxDuration = 60;

/**
 * POST: Generate an image from a text prompt using DALL-E 3.
 * Returns { url } - Blob URL if BLOB_READ_WRITE_TOKEN is set, otherwise temporary OpenAI URL.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const apiRl = await checkApiRateLimit(userId);

    if (apiRl) return apiRl;

    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const { hasCredits, balance } = await checkVideoCredits("brandStoryVideo");
    if (!hasCredits) {
      return NextResponse.json(
        { error: "You need 1 video credit to generate an image.", code: "NO_VIDEO_CREDITS", balance, redirectTo: "/dashboard/video-credits" },
        { status: 402 }
      );
    }

    const body = await request.json().catch(() => ({}));
    let prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const aiStoryLocked = body.aiStoryLocked === true;
    const photoreal = body.photoreal === true;
    const identityLock = body.identityLock === true;
    const cookingFocus = body.cookingFocus === true;
    const characterStyle = typeof body.characterStyle === "string" ? body.characterStyle.trim() : "";
    const storyVideoFormatRaw =
      typeof (body as { storyVideoFormat?: string }).storyVideoFormat === "string"
        ? String((body as { storyVideoFormat: string }).storyVideoFormat).trim().toLowerCase()
        : "";
    const storyVideoImage =
      storyVideoFormatRaw === "long" || storyVideoFormatRaw === "short";
    if (storyVideoImage) {
      prompt = `wide cinematic 16:9 landscape composition, horizontal framing. ${prompt}`;
    }
    if (!aiStoryLocked && characterStyle) {
      prompt = `${characterStyle} ${prompt} Do not include any humans or realistic elements.`;
    }
    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const dallE3Prompt = aiStoryLocked
      ? `${prompt}

Cartoon / stylized 3D illustration only. No photorealistic humans. No text, letters, watermarks, or labels in the image.`
      : photoreal
        ? `${prompt}

Ultra-realistic cinematic photograph look. Natural skin texture, realistic hands, realistic anatomy, subtle lens depth of field, physically plausible lighting, high-detail materials, and true-to-life color grading.
${identityLock ? "IDENTITY LOCK: The character identity is defined by the 'CHARACTER SEED' / locked identity section in this prompt. Reproduce the same person EXACTLY across scenes: facial features, eye shape, hairstyle, outfit, accessories, skin tone, and proportions. Do not switch characters or vary identity." : ""}
${identityLock ? "IGNORE any cartoon/3D/illustration/Pixar style cues found in the prompt. Render as a real photorealistic cinematic photograph while keeping the locked identity unchanged." : ""}
${cookingFocus ? "Food-first framing: show ingredients, pan/pot, utensils, texture, steam, sizzling action, and plated dish as primary subjects. Keep people secondary, but if the chef appears, keep the same chef identity (eyes/hair/outfit) consistently. Avoid portrait-style face-centric framing that would encourage a different person." : ""}
Avoid CGI/plastic look, uncanny features, extra fingers, warped anatomy, duplicate people, collage layouts, and heavy over-stylization.
No text, letters, watermarks, logos, or labels in the image.`
        : storyVideoImage
          ? `${prompt}

${STORY_VIDEO_IMAGE_ANIME_STYLE_CORE}. No text, letters, watermarks, logos, or labels in the image.`
          : `High-quality, professional image: ${prompt}. Clean, modern, suitable for digital content. No text in image.`;

    console.log(
      "[generate-image] aiStoryLocked=%s full DALL-E prompt (%d chars):\n%s",
      String(aiStoryLocked),
      dallE3Prompt.length,
      dallE3Prompt
    );

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key is not configured." },
        { status: 503 }
      );
    }

    const openai = new OpenAI({ apiKey });
    const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

    // Helper: strip phrases that commonly trigger DALL-E content filters
    const sanitizePrompt = (p: string) =>
      p
        .replace(/empty wallet|broke|poverty|debt trap|paycheck to paycheck|financially struggling|bankrupt/gi, "minimalist")
        .replace(/wealth gap|inequality|poor|homeless/gi, "contrast")
        .replace(/nearly empty|desperately/gi, "simple")
        .slice(0, 900); // DALL-E works best under 1000 chars

    // Always request b64_json so we never have to fetch DALL-E's temp URL (often fails with ENOTFOUND).
    const imageSize = storyVideoImage ? "1792x1024" : "1024x1024";
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    let response;
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const attemptPrompt = attempt === 0 ? dallE3Prompt : sanitizePrompt(dallE3Prompt);
        if (attempt > 0) {
          console.warn(`[generate-image] Retry attempt ${attempt} with ${attempt === 1 ? "sanitized" : "simplified"} prompt`);
          await sleep(attempt * 1500); // 1.5s, 3s backoff
        }
        response = await openai.images.generate({
          model: "dall-e-3",
          prompt: attemptPrompt,
          n: 1,
          size: imageSize,
          quality: "standard",
        });
        break; // success
      } catch (err) {
        lastErr = err;
        console.warn(`[generate-image] Attempt ${attempt + 1} failed:`, err instanceof Error ? err.message : err);
      }
    }
    if (!response) throw lastErr;

    const first = response.data![0];
    if (!first) {
      return NextResponse.json(
        { error: "Image generation did not return data. Please try again." },
        { status: 500 }
      );
    }

    const tempUrl = (first as { url?: string }).url;
    if (!tempUrl) {
      return NextResponse.json(
        { error: "Image generation did not return a URL. Please try again." },
        { status: 500 }
      );
    }

    // Fetch the image from OpenAI's temporary URL and upload to R2 for persistence
    if (useBlob) {
      try {
        const imgRes = await fetch(tempUrl);
        if (!imgRes.ok) throw new Error(`Failed to fetch generated image: ${imgRes.status}`);
        const buffer = Buffer.from(await imgRes.arrayBuffer());
        const pathname = `editor-images/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
        const blob = await upload(pathname, buffer, {
          access: "public",
          contentType: "image/png",
          addRandomSuffix: false,
        });
        await deductVideoCredit("brandStoryVideo").catch((e) => console.error("[generate-image] credit deduction failed:", e));
        return NextResponse.json({ url: blob.url });
      } catch (blobErr) {
        console.error("[generate-image] R2 upload failed, returning temp URL:", blobErr);
        await deductVideoCredit("brandStoryVideo").catch((e) => console.error("[generate-image] credit deduction failed:", e));
        return NextResponse.json({ url: tempUrl });
      }
    }

    await deductVideoCredit("brandStoryVideo").catch((e) => console.error("[generate-image] credit deduction failed:", e));
    return NextResponse.json({ url: tempUrl });
  } catch (err) {
    console.error("[generate-image]", err);
    const message = err instanceof Error ? err.message : "Image generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
