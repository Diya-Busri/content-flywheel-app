export const dynamic = "force-dynamic";
import { auth } from "@clerk/nextjs/server";
import { upload } from "@/lib/storage";
import { NextResponse } from "next/server";
import { checkVideoCredits, deductVideoCredit } from "@/actions/video-credits-actions";
import { checkSpendLimit } from "@/lib/spend-guard";

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
async function generateWithIdeogram(prompt: string, style: string, colorHint: string): Promise<string> {
  const styleSuffix = STYLE_SUFFIXES[style] ?? STYLE_SUFFIXES.bold;
  const ideogramStyle = IDEOGRAM_STYLE_MAP[style] ?? "DESIGN";
  const colorClause = colorHint !== "white" && colorHint !== "#FFFFFF"
    ? `, ${colorHint} text and graphic elements`
    : ", white text and graphic elements";
  const fullPrompt = `${prompt}${colorClause}, ${styleSuffix}, t-shirt graphic, isolated on white background`;

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
async function generateWithFlux(prompt: string, style: string, colorHint: string): Promise<string> {
  const styleSuffix = STYLE_SUFFIXES[style] ?? STYLE_SUFFIXES.bold;
  const colorClause = colorHint !== "white" && colorHint !== "#FFFFFF"
    ? `, ${colorHint} graphic elements`
    : "";
  const fullPrompt = `${prompt}${colorClause}, ${styleSuffix}, t-shirt graphic, isolated design, transparent background, high quality`;

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

  const sg = await checkSpendLimit("fal", userId);
  if (sg) return sg;

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
  let textColor: string;
  try {
    const body = await request.json() as { prompt?: string; style?: string; textColor?: string };
    prompt = (body.prompt ?? "").trim();
    style = body.style ?? "bold";
    // textColor is a hex string like "#FFFFFF" or "#000000"
    const rawColor = (body.textColor ?? "#FFFFFF").trim();
    textColor = /^#[0-9A-Fa-f]{6}$/.test(rawColor) ? rawColor : "#FFFFFF";
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Convert hex to human-readable colour name hint for the prompt
  function hexToColorHint(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
    if (luminance > 0.9) return "white";
    if (luminance < 0.1) return "black";
    // Named colour approximation
    if (r > 200 && g < 100 && b < 100) return "red";
    if (r > 200 && g > 150 && b < 80) return "orange";
    if (r > 200 && g > 200 && b < 80) return "yellow";
    if (r < 80 && g > 150 && b < 80) return "green";
    if (r < 80 && g < 80 && b > 180) return "blue";
    if (r > 100 && g < 80 && b > 150) return "purple";
    return hex; // fallback to raw hex
  }
  const colorHint = hexToColorHint(textColor);

  if (!prompt) return NextResponse.json({ error: "Prompt is required" }, { status: 400 });

  // Route to best model — typography style always uses Ideogram (best text rendering)
  const useIdeogram = style === "typography" || promptHasText(prompt);
  let rawImageUrl: string;
  try {
    rawImageUrl = useIdeogram
      ? await generateWithIdeogram(prompt, style, colorHint)
      : await generateWithFlux(prompt, style, colorHint);
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
  const blob = await upload(
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
