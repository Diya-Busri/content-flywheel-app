import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DIMENSIONS: Record<string, "1024x1024" | "1792x1024" | "1024x1792"> = {
  youtube: "1792x1024",
  tiktok: "1024x1792",
  instagram: "1024x1024",
};

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const apiRl = await checkApiRateLimit(userId);

    if (apiRl) return apiRl;

    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const dimKey = Object.keys(DIMENSIONS).includes(body.dimensions) ? body.dimensions : "youtube";

    if (!prompt) return NextResponse.json({ error: "Prompt is required." }, { status: 400 });

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: "OpenAI API key not configured." }, { status: 503 });

    const size = DIMENSIONS[dimKey];
    const openai = new OpenAI({ apiKey });
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size,
      quality: "standard",
      style: "natural",
      response_format: "url",
    });

    const imageUrl = response.data[0]?.url;
    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json({ error: "No image URL returned." }, { status: 500 });
    }

    return NextResponse.json({ url: imageUrl, dimensions: dimKey });
  } catch (err) {
    console.error("[thumbnails/generate-image]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Generation failed" }, { status: 500 });
  }
}
