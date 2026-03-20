import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { put } from "@vercel/blob";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";

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

    const body = await request.json().catch(() => ({}));
    let prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const aiStoryLocked = body.aiStoryLocked === true;
    const characterStyle = typeof body.characterStyle === "string" ? body.characterStyle.trim() : "";
    if (!aiStoryLocked && characterStyle) {
      prompt = `${characterStyle} ${prompt} Do not include any humans or realistic elements.`;
    }
    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const dallE3Prompt = aiStoryLocked
      ? `${prompt}

Cartoon / stylized 3D illustration only. No photorealistic humans. No text, letters, watermarks, or labels in the image.`
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
    // Always request b64_json so we never have to fetch DALL-E's temp URL (often fails with ENOTFOUND).
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: dallE3Prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: "natural",
      response_format: "b64_json",
    });

    const first = response.data[0];
    if (!first) {
      return NextResponse.json(
        { error: "Image generation did not return data. Please try again." },
        { status: 500 }
      );
    }

    const b64 = (first as { b64_json?: string }).b64_json;
    if (!b64 || typeof b64 !== "string") {
      return NextResponse.json(
        { error: "Image generation did not return image data. Please try again." },
        { status: 500 }
      );
    }

    const buffer = Buffer.from(b64, "base64");
    const dataUrl = `data:image/png;base64,${b64}`;

    if (useBlob) {
      try {
        const pathname = `editor-images/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
        const blob = await put(pathname, buffer, {
          access: "public",
          contentType: "image/png",
          addRandomSuffix: false,
        });
        return NextResponse.json({ url: blob.url });
      } catch (blobErr) {
        console.error("[generate-image] Blob upload failed, returning data URL:", blobErr);
        return NextResponse.json({ url: dataUrl });
      }
    }

    return NextResponse.json({ url: dataUrl });
  } catch (err) {
    console.error("[generate-image]", err);
    const message = err instanceof Error ? err.message : "Image generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
