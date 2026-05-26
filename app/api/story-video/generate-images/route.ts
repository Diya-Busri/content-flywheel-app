import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fal } from "@fal-ai/client";
import { put } from "@vercel/blob";
import { checkSpendLimit } from "@/lib/spend-guard";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { checkVideoCredits, deductVideoCredit } from "@/actions/video-credits-actions";
import {
  STORY_VIDEO_DEFAULT_ART_STYLE,
  parseStoryVideoFormatFromBody,
  sanitizeStoryVideoVisualDescription,
  type StoryVideoFormat,
} from "@/lib/story-video";

export const dynamic = "force-dynamic";
/** FLUX runs can be slow for many scenes. */
export const maxDuration = 300;

const FLUX_TEXT_TO_IMAGE = "fal-ai/flux/dev";

const MAX_SCENES_SHORT = 24;
const MAX_SCENES_LONG = 50;
const MAX_ART_STYLE_CHARS = 2500;
/** Reasonable cap for fal prompt length. */
const MAX_PROMPT_CHARS = 3800;
const DELAY_MS_BETWEEN_CALLS = 450;

/** Prepended to each scene’s visual description for FLUX (exact copy per product spec). */
export const STORY_VIDEO_FLUX_PROMPT_PREFIX =
  "anime illustration, cel-shaded, Studio Ghibli style, warm soft colours, clean line art, ";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getVisualFromScene(row: Record<string, unknown>): string {
  if (typeof row.visualDescription === "string") return row.visualDescription.trim();
  if (typeof row.visual_description === "string") return row.visual_description.trim();
  return "";
}

/**
 * FLUX prompt: style lead-in + scene visual + optional batch art-style line (user default or body).
 */
export function buildStoryVideoImagePrompt(
  visualDescription: string,
  artStyle: string,
  _format?: StoryVideoFormat
): string {
  const scenePart = sanitizeStoryVideoVisualDescription(visualDescription);
  const a = artStyle.trim();
  const core = `${STORY_VIDEO_FLUX_PROMPT_PREFIX}${scenePart}${a ? ` ${a}` : ""}`.trim();
  if (core.length > MAX_PROMPT_CHARS) {
    return `${core.slice(0, MAX_PROMPT_CHARS - 1)}…`;
  }
  return core;
}

async function fluxDevToUrl(prompt: string, folder: string): Promise<string> {
  const result = await fal.subscribe(FLUX_TEXT_TO_IMAGE, {
    input: {
      prompt,
      image_size: "landscape_16_9",
      num_inference_steps: 28,
      guidance_scale: 3.5,
      num_images: 1,
      output_format: "png",
      enable_safety_checker: true,
    },
    logs: false,
  });

  const data = result.data as { images?: { url?: string }[] };
  const rawUrl = data?.images?.[0]?.url;
  if (!rawUrl || typeof rawUrl !== "string") {
    throw new Error("fal.ai did not return an image URL.");
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return rawUrl;
  }

  try {
    const imgRes = await fetch(rawUrl);
    if (!imgRes.ok) throw new Error("fetch generated image failed");
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const pathname = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
    const blob = await put(pathname, buffer, {
      access: "public",
      contentType: "image/png",
      addRandomSuffix: false,
    });
    return blob.url;
  } catch (e) {
    console.error("[story-video/generate-images] Blob upload failed, using fal URL:", e);
    return rawUrl;
  }
}

/**
 * POST /api/story-video/generate-images
 * Body: { scenes: Array<{ visualDescription }>, artStyle?: string } — artStyle defaults to STORY_VIDEO_DEFAULT_ART_STYLE
 * Returns: string[] — public image URLs (or fal URLs if Blob is unset), same order as scenes.
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
    const sg = await checkSpendLimit("fal", userId);
    if (sg) return sg;

    const { hasCredits, balance } = await checkVideoCredits("brandStoryVideo");
    if (!hasCredits) {
      return NextResponse.json(
        { error: "You need 1 video credit to generate images.", code: "NO_VIDEO_CREDITS", balance, redirectTo: "/dashboard/video-credits" },
        { status: 402 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const format = parseStoryVideoFormatFromBody(body);
    const rawScenes = Array.isArray(body.scenes) ? body.scenes : [];
    const maxScenes = format === "long" ? MAX_SCENES_LONG : MAX_SCENES_SHORT;
    const artStyle = typeof body.artStyle === "string" ? body.artStyle.trim() : "";
    const art_style = typeof body.art_style === "string" ? body.art_style.trim() : "";
    const style = (artStyle || art_style || STORY_VIDEO_DEFAULT_ART_STYLE).trim();
    if (style.length > MAX_ART_STYLE_CHARS) {
      return NextResponse.json(
        { error: `artStyle must be at most ${MAX_ART_STYLE_CHARS} characters` },
        { status: 400 }
      );
    }
    if (rawScenes.length === 0) {
      return NextResponse.json({ error: "scenes must be a non-empty array" }, { status: 400 });
    }
    if (rawScenes.length > maxScenes) {
      return NextResponse.json(
        { error: `At most ${maxScenes} scenes per request for this format` },
        { status: 400 }
      );
    }

    const scenes = rawScenes.map((s) =>
      s && typeof s === "object" ? (s as Record<string, unknown>) : {}
    );
    for (let i = 0; i < scenes.length; i++) {
      if (!getVisualFromScene(scenes[i])) {
        return NextResponse.json(
          { error: `Scene ${i + 1} is missing visualDescription` },
          { status: 400 }
        );
      }
    }

    const apiKey = process.env.FAL_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "FAL_API_KEY is not configured. Add it to .env.local or Vercel." },
        { status: 503 }
      );
    }

    fal.config({ credentials: apiKey });
    const urls: string[] = [];

    for (let i = 0; i < scenes.length; i++) {
      if (i > 0) {
        await sleep(DELAY_MS_BETWEEN_CALLS);
      }
      const visual = getVisualFromScene(scenes[i]);
      const prompt = buildStoryVideoImagePrompt(visual, style, format);
      try {
        const url = await fluxDevToUrl(prompt, "story-video-scenes");
        urls.push(url);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Image generation failed";
        console.error(`[story-video/generate-images] Scene ${i + 1}:`, e);
        return NextResponse.json(
          {
            error: msg,
            sceneIndex: i,
            partialUrls: urls,
          },
          { status: 502 }
        );
      }
    }

    await deductVideoCredit("brandStoryVideo").catch((e) => console.error("[story-video/generate-images] credit deduction failed:", e));
    return NextResponse.json(urls);
  } catch (e) {
    console.error("[story-video/generate-images]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
