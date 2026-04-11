import { auth } from "@clerk/nextjs/server";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { checkVideoCredits, deductVideoCredit } from "@/actions/video-credits-actions";

const FAL_API_KEY = () => {
  const key = process.env.FAL_API_KEY?.trim();
  if (!key) throw new Error("FAL_API_KEY is not set");
  return key;
};

const STYLE_SUFFIXES: Record<string, string> = {
  typography: "clean typographic design, elegant lettering, professional logo, isolated on white, high contrast",
  bold: "bold graphic design, thick outlines, high contrast, vector art, t-shirt print style, solid colors",
  vintage: "vintage retro graphic, distressed texture, worn look, aged colors, screen print style",
  minimalist: "minimalist flat design, simple clean shapes, limited color palette, modern",
  lineart: "line art illustration, pen and ink sketch, monochrome, detailed linework",
  abstract: "abstract geometric pattern, colorful shapes, modern art, bold colors",
};

const IDEOGRAM_STYLE_MAP: Record<string, string> = {
  typography: "DESIGN",
  bold: "DESIGN",
  vintage: "DESIGN",
  minimalist: "DESIGN",
  lineart: "DESIGN",
  abstract: "GENERAL",
};

/**
 * Detect if the prompt is asking for text to appear in the design.
 * Quoted strings, "that says", "with the word(s)", "reading" are strong signals.
 */
function promptHasText(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return (
    /["']/.test(prompt) ||
    /\bthat says\b/.test(lower) ||
    /\bwith (the )?(word|text|phrase|lettering|writing)\b/.test(lower) ||
    /\breading\b/.test(lower) ||
    /\bspelling\b/.test(lower) ||
    /\bwritten\b/.test(lower)
  );
}

/** Generate with fal-ai/ideogram/v2 — excellent text rendering */
async function generateWithIdeogram(prompt: string, style: string): Promise<string> {
  const styleSuffix = STYLE_SUFFIXES[style] ?? STYLE_SUFFIXES.bold;
  const ideogramStyle = IDEOGRAM_STYLE_MAP[style] ?? "DESIGN";
  const fullPrompt = `${prompt}, ${styleSuffix}, t-shirt graphic, isolated on white background`;

  const res = await fetch("https://fal.run/fal-ai/ideogram/v2", {
    method: "POST",
    headers: {
      Authorization: `Key ${FAL_API_KEY()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: fullPrompt,
      aspect_ratio: "1:1",
      style_type: ideogramStyle,
      magic_prompt_option: "AUTO",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ideogram generation failed: ${text.slice(0, 200)}`);
  }

  const data = await res.json() as { images?: Array<{ url: string }> };
  const url = data.images?.[0]?.url;
  if (!url) throw new Error("No image returned from Ideogram");
  return url;
}

/** Generate with fal-ai/flux/schnell — fast graphic generation (no text) */
async function generateWithFlux(prompt: string, style: string): Promise<string> {
  const styleSuffix = STYLE_SUFFIXES[style] ?? STYLE_SUFFIXES.bold;
  const fullPrompt = `${prompt}, ${styleSuffix}, t-shirt graphic, isolated design, transparent background, high quality`;

  const res = await fetch("https://fal.run/fal-ai/flux/schnell", {
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

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FLUX generation failed: ${text.slice(0, 200)}`);
  }

  const data = await res.json() as { images?: Array<{ url: string }> };
  const url = data.images?.[0]?.url;
  if (!url) throw new Error("No image returned from FLUX");
  return url;
}

/** Remove background using fal-ai/birefnet */
async function removeBackground(imageUrl: string): Promise<string> {
  const res = await fetch("https://fal.run/fal-ai/birefnet", {
    method: "POST",
    headers: {
      Authorization: `Key ${FAL_API_KEY()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image_url: imageUrl,
      model: "General Use (Light)",
      operating_resolution: "1024x1024",
      output_format: "png",
    }),
  });

  if (!res.ok) {
    // Non-fatal — return original if bg removal fails
    console.warn("[ai-design] birefnet failed, using original image");
    return imageUrl;
  }

  const data = await res.json() as { image?: { url: string } };
  return data.image?.url ?? imageUrl;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Credit check
  const { hasCredits, balance } = await checkVideoCredits("aiDesign");
  if (!hasCredits) {
    return NextResponse.json(
      {
        error: "You need 1 video credit to generate a design.",
        code: "NO_VIDEO_CREDITS",
        balance,
        redirectTo: "/dashboard/video-credits",
      },
      { status: 402 }
    );
  }

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

  // Route to best model — typography style always uses Ideogram (best text rendering)
  const useIdeogram = style === "typography" || promptHasText(prompt);
  let rawImageUrl: string;
  try {
    rawImageUrl = useIdeogram
      ? await generateWithIdeogram(prompt, style)
      : await generateWithFlux(prompt, style);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }

  // Remove background (always — gives clean transparent PNG for print)
  const cleanImageUrl = await removeBackground(rawImageUrl);

  // Re-host to Vercel Blob
  const imgRes = await fetch(cleanImageUrl);
  if (!imgRes.ok) {
    return NextResponse.json({ error: "Failed to fetch generated image" }, { status: 500 });
  }

  const buffer = Buffer.from(await imgRes.arrayBuffer());
  const blob = await put(
    `pod-designs/${userId}/ai-${Date.now()}.png`,
    buffer,
    { access: "public", contentType: "image/png" }
  );

  // Deduct credit after successful generation
  await deductVideoCredit("aiDesign").catch((e) =>
    console.error("[ai-design] credit deduction failed:", e)
  );

  return NextResponse.json({ url: blob.url, model: useIdeogram ? "ideogram" : "flux" });
}
