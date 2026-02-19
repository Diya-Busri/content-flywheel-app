import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { put } from "@vercel/blob";

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

    const body = await request.json().catch(() => ({}));
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key is not configured." },
        { status: 503 }
      );
    }

    const openai = new OpenAI({ apiKey });
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: `High-quality, professional image: ${prompt}. Clean, modern, suitable for digital content. No text in image.`,
      n: 1,
      size: "1024x1024",
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

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const imageRes = await fetch(imageUrl);
        if (!imageRes.ok) throw new Error("Failed to fetch generated image");
        const buffer = Buffer.from(await imageRes.arrayBuffer());
        const pathname = `editor-images/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
        const blob = await put(pathname, buffer, {
          access: "public",
          contentType: "image/png",
          addRandomSuffix: false,
        });
        return NextResponse.json({ url: blob.url });
      } catch (blobErr) {
        console.error("[generate-image] Blob upload failed, returning temporary URL:", blobErr);
      }
    }

    return NextResponse.json({ url: imageUrl });
  } catch (err) {
    console.error("[generate-image]", err);
    const message = err instanceof Error ? err.message : "Image generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
