import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
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

const STYLE_PROMPTS: Record<StyleId, string> = {
  "modern-gradient":
    "Professional digital product thumbnail with modern gradient background, title: [title], clean typography, no text in image, abstract shapes",
  "clean-minimal":
    "Minimalist product thumbnail, clean white background, subtle accents, professional, no text in image",
  "bold-dark":
    "Bold dark themed product thumbnail, dramatic lighting, professional, no text in image",
  lifestyle:
    "Warm lifestyle themed product thumbnail, cozy aesthetic, professional, no text in image",
};

function buildPrompt(style: StyleId, title: string): string {
  const base = STYLE_PROMPTS[style];
  return base.replace("[title]", title || "Digital Product");
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
    const prompt = buildPrompt(style, title || productType);

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
