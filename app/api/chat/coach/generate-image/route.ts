import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const STYLE_KEYWORDS = /watercolor|oil\s*painting|sketch|minimalist|minimal|realistic|photorealistic|cartoon|3d\s*render|vintage|abstract|anime|manga|pixel\s*art|photograph|photo\s*style|cinematic|noir|b-roll|style\s*of|in\s*the\s*style|look\s*like|suitable\s*for\s*video/i;

const BUCKET = "timeline-media";

/** gpt-image-1 landscape (closest to 16:9) and square sizes. */
const SIZE_16_9 = "1536x1024" as const;
const SIZE_PORTRAIT = "1024x1536" as const;
const SIZE_SQUARE = "1024x1024" as const;

const PEOPLE_KEYWORDS = /\bperson|people|someone|woman|man|girl|boy|human|face|portrait\b/i;

/**
 * Enhance prompt for DALL-E: append a suitable style suffix unless user specified one.
 * Avoid forcing "photorealistic" on people prompts — that raises content policy flags.
 */
function enhancePrompt(userPrompt: string): string {
  const trimmed = userPrompt.trim();
  if (STYLE_KEYWORDS.test(trimmed)) return trimmed;
  if (PEOPLE_KEYWORDS.test(trimmed)) {
    return `${trimmed}. Vibrant digital illustration, modern aesthetic style, professional quality.`;
  }
  return `${trimmed}. Photorealistic, professional b-roll style, suitable for video.`;
}

function isBucketMissingError(err: unknown): boolean {
  const msg = String(err instanceof Error ? err.message : err).toLowerCase();
  return /bucket|not found|no such|404|does not exist/.test(msg);
}

/** Upload image bytes to Supabase Storage and return public URL. Returns null if Supabase not configured. */
async function uploadImageToStorage(userId: string, buffer: Buffer, contentType: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const ext = (contentType || "image/png").toLowerCase().includes("png") ? "png" : "jpg";
  const path = `${userId}/dalle/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  let result = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: contentType || "image/png",
    upsert: true,
  });
  if (result.error && isBucketMissingError(result.error)) {
    await supabase.storage.createBucket(BUCKET, { public: true });
    result = await supabase.storage.from(BUCKET).upload(path, buffer, {
      contentType: contentType || "image/png",
      upsert: true,
    });
  }
  if (result.error) {
    console.error("[generate-image] Supabase upload error:", result.error.message);
    return null;
  }
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(result.data.path);
  return urlData.publicUrl;
}

/**
 * POST: Generate ONE 16:9 image per script section (DALL-E 3), then persist URL.
 * Body: { prompt: string, aspectRatio?: "16:9" }. One image per request (no batching).
 * - Uses 1792x1024 for 16:9, quality "standard".
 * - Uploads image to Supabase Storage so URL is stable (stored in DB when user exports timeline).
 * Returns { url } (permanent if Supabase configured) or { error }.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;
    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const body = await req.json().catch(() => ({}));
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) return NextResponse.json({ error: "prompt is required" }, { status: 400 });

    const aspectRatio = typeof body.aspectRatio === "string" ? body.aspectRatio : undefined;
    // Force 16:9 for script/section images so timeline and export are reliable
    const size = aspectRatio === "16:9" ? SIZE_16_9 : aspectRatio === "9:16" ? SIZE_PORTRAIT : SIZE_SQUARE;

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 503 });

    const openai = new OpenAI({ apiKey });
    const enhanced = enhancePrompt(prompt);

    let b64: string | undefined;
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await openai.images.generate({
          model: "gpt-image-1",
          prompt: enhanced,
          n: 1,
          size,
          quality: "low",
        });
        b64 = response.data[0]?.b64_json;
        if (b64) break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!b64) {
      const msg = lastErr instanceof Error ? lastErr.message : "No image returned";
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const buf = Buffer.from(b64, "base64");
    const permanentUrl = await uploadImageToStorage(userId, buf, "image/png");
    if (permanentUrl) return NextResponse.json({ url: permanentUrl });

    // Fallback: return as data URL if storage not configured
    return NextResponse.json({ url: `data:image/png;base64,${b64}` });
  } catch (err) {
    console.error("[chat/coach/generate-image]", err);
    const message = err instanceof Error ? err.message : "Image generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
