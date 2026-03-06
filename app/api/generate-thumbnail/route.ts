import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 60;

const STYLES = [
  "modern-gradient",
  "clean-minimal",
  "bold-dark",
  "lifestyle",
] as const;
type StyleId = (typeof STYLES)[number];

/** Background-only prompts: no text or title in the image. Title is overlaid as HTML/CSS in the UI. */
const STYLE_PROMPTS: Record<StyleId, string> = {
  "modern-gradient":
    "Professional digital product thumbnail background, modern gradient, abstract shapes, clean and elegant, no text, no words, no letters",
  "clean-minimal":
    "Minimalist product thumbnail background, clean white, subtle shadows and accents, professional, no text, no words",
  "bold-dark":
    "Bold dark product thumbnail background, dramatic lighting, premium feel, no text, no words",
  lifestyle:
    "Warm lifestyle product thumbnail background, cozy aesthetic, flat lay or desk setting, no text, no words",
};

function buildPrompt(style: StyleId): string {
  return STYLE_PROMPTS[style];
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const subtitle = typeof body.subtitle === "string" ? body.subtitle : "";
    const style = STYLES.includes(body.style as StyleId) ? (body.style as StyleId) : "modern-gradient";
    const productType = typeof body.productType === "string" ? body.productType : "Digital Product";
    const orientation = body.orientation === "vertical" ? "vertical" : "horizontal";
    const size = orientation === "vertical" ? "1024x1792" : "1792x1024";

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key is not configured. Add OPENAI_API_KEY to your environment." },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });
    const prompt = buildPrompt(style);

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
      return NextResponse.json(
        { error: "Image generation did not return a URL. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: imageUrl, style, orientation });
  } catch (err) {
    console.error("[generate-thumbnail]", err);
    const message =
      err instanceof Error ? err.message : "Thumbnail generation failed";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
