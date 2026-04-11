import { auth } from "@clerk/nextjs/server";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

const FAL_API_KEY = () => {
  const key = process.env.FAL_API_KEY?.trim();
  if (!key) throw new Error("FAL_API_KEY is not set");
  return key;
};

const STYLE_SUFFIXES: Record<string, string> = {
  bold: "bold graphic design, thick outlines, high contrast, vector art, t-shirt print style, solid colors, no background",
  vintage: "vintage retro graphic, distressed texture, worn look, aged colors, screen print style, t-shirt graphic",
  minimalist: "minimalist flat design, simple clean shapes, limited color palette, modern, t-shirt graphic",
  lineart: "line art illustration, pen and ink sketch, monochrome, detailed linework, t-shirt graphic",
  abstract: "abstract geometric pattern, colorful shapes, modern art, bold colors, t-shirt graphic",
};

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let prompt: string;
  let style: string;
  try {
    const body = await request.json() as { prompt?: string; style?: string };
    prompt = (body.prompt ?? "").trim();
    style = body.style ?? "bold";
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!prompt) return NextResponse.json({ error: "Prompt is required" }, { status: 400 });

  const styleSuffix = STYLE_SUFFIXES[style] ?? STYLE_SUFFIXES.bold;
  const fullPrompt = `${prompt}, ${styleSuffix}, transparent background, isolated design, high quality`;

  // Call fal.ai FLUX schnell (fast, sync endpoint)
  const falRes = await fetch("https://fal.run/fal-ai/flux/schnell", {
    method: "POST",
    headers: {
      Authorization: `Key ${FAL_API_KEY()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: fullPrompt,
      image_size: "square_hd",
      num_inference_steps: 4,
      num_images: 1,
      enable_safety_checker: true,
    }),
  });

  if (!falRes.ok) {
    const text = await falRes.text();
    return NextResponse.json({ error: `Image generation failed: ${text.slice(0, 200)}` }, { status: 500 });
  }

  const falData = await falRes.json() as { images?: Array<{ url: string }> };
  const imageUrl = falData.images?.[0]?.url;
  if (!imageUrl) return NextResponse.json({ error: "No image returned from fal.ai" }, { status: 500 });

  // Fetch and re-host to Vercel Blob so we own the URL
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) return NextResponse.json({ error: "Failed to fetch generated image" }, { status: 500 });

  const buffer = Buffer.from(await imgRes.arrayBuffer());
  const blob = await put(
    `pod-designs/${userId}/ai-${Date.now()}.png`,
    buffer,
    { access: "public", contentType: "image/png" }
  );

  return NextResponse.json({ url: blob.url });
}
