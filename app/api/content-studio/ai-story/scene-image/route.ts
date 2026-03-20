import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fal } from "@fal-ai/client";
import { put } from "@vercel/blob";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { sanitizeAiStorySceneImagePrompt } from "@/lib/ai-story-character-style";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** FLUX.1 [dev] image-to-image — reference image acts as an identity anchor (IP-Adapter–style); user prompt = action/setting only. */
const FLUX_IMG2IMG = "fal-ai/flux/dev/image-to-image";

/**
 * POST: Scene still using img2img (fal.ai). Body:
 * { referenceImageUrl: string, prompt: string, strength?: number }
 * Returns { url: string }
 */
export async function POST(request: NextRequest) {
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
    const referenceImageUrl =
      typeof body.referenceImageUrl === "string" ? body.referenceImageUrl.trim() : "";
    let prompt = sanitizeAiStorySceneImagePrompt(
      typeof body.prompt === "string" ? body.prompt.trim() : ""
    );
    const strength =
      typeof body.strength === "number" && body.strength > 0 && body.strength <= 1
        ? body.strength
        : 0.88;

    if (!referenceImageUrl || !prompt) {
      return NextResponse.json(
        { error: "referenceImageUrl and prompt are required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.FAL_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "FAL_API_KEY is not configured. Add it to .env.local or Vercel." },
        { status: 503 }
      );
    }

    fal.config({ credentials: apiKey });

    const actionPrefix =
      "Use the reference image as an identity anchor (same character design, colors, proportions — like IP-Adapter). " +
      "Output ONE cohesive cinematic scene still — single composition, single moment in time. " +
      "No character sheet, sprite sheet, grid, panels, or tiled layout. " +
      "Scene and action only: ";
    prompt = actionPrefix + prompt;

    console.log(
      "[scene-image] fal img2img strength=%s promptLen=%s ref=%s",
      String(strength),
      String(prompt.length),
      referenceImageUrl.slice(0, 80)
    );

    const result = await fal.subscribe(FLUX_IMG2IMG, {
      input: {
        image_url: referenceImageUrl,
        prompt,
        strength,
        num_inference_steps: 32,
        guidance_scale: 3.5,
        num_images: 1,
        output_format: "png",
        enable_safety_checker: true,
      },
      logs: false,
    });

    const data = result.data as {
      images?: { url?: string }[];
    };
    const rawUrl = data?.images?.[0]?.url;
    if (!rawUrl || typeof rawUrl !== "string") {
      return NextResponse.json(
        { error: "Fal did not return an image URL" },
        { status: 502 }
      );
    }

    const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
    if (useBlob) {
      try {
        const imgRes = await fetch(rawUrl);
        if (!imgRes.ok) throw new Error("fetch scene image failed");
        const buf = Buffer.from(await imgRes.arrayBuffer());
        const pathname = `ai-story-scenes/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
        const blob = await put(pathname, buf, {
          access: "public",
          contentType: "image/png",
          addRandomSuffix: false,
        });
        return NextResponse.json({ url: blob.url });
      } catch (e) {
        console.error("[scene-image] Blob upload failed, returning fal URL:", e);
      }
    }

    return NextResponse.json({ url: rawUrl });
  } catch (e) {
    console.error("[content-studio/ai-story/scene-image]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
