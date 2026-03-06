import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";

export const runtime = "nodejs";
export const maxDuration = 60;

const STYLE_KEYWORDS = /watercolor|oil\s*painting|sketch|minimalist|minimal|realistic|cartoon|3d\s*render|vintage|abstract|anime|manga|pixel\s*art|photograph|photo\s*style|cinematic|noir|style\s*of|in\s*the\s*style|look\s*like/i;

/**
 * Enhance prompt for DALL-E: append default style unless user specified a style.
 */
function enhancePrompt(userPrompt: string): string {
  const trimmed = userPrompt.trim();
  if (STYLE_KEYWORDS.test(trimmed)) return trimmed;
  return `${trimmed}. High quality, clean, digital illustration style.`;
}

/**
 * POST: Generate image with DALL-E 3 for AI Coach.
 * Body: { prompt: string } (user message).
 * Returns { url } or { error }.
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

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 503 });

    const openai = new OpenAI({ apiKey });
    const enhanced = enhancePrompt(prompt);

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: enhanced,
      n: 1,
      size: "1024x1024",
      response_format: "url",
    });

    const imageUrl = response.data[0]?.url;
    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json({ error: "No image URL returned" }, { status: 500 });
    }

    return NextResponse.json({ url: imageUrl });
  } catch (err) {
    console.error("[chat/coach/generate-image]", err);
    const message = err instanceof Error ? err.message : "Image generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
