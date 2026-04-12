import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";

export const dynamic = "force-dynamic";

const FAL_API_KEY = () => {
  const key = process.env.FAL_API_KEY?.trim();
  if (!key) throw new Error("FAL_API_KEY is not set");
  return key;
};

async function generateBgImage(prompt: string): Promise<string> {
  const res = await fetch("https://fal.run/fal-ai/flux/schnell", {
    method: "POST",
    headers: {
      Authorization: `Key ${FAL_API_KEY()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      image_size: "portrait_16_9",
      num_inference_steps: 4,
      num_images: 1,
      enable_safety_checker: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`fal.ai error: ${text.slice(0, 300)}`);
  }

  const data = await res.json() as { images?: Array<{ url: string }> };
  const url = data.images?.[0]?.url;
  if (!url) throw new Error("No image returned");
  return url;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const body = (await request.json().catch(() => ({}))) as {
      topic?: string;
      brandName?: string;
      colorScheme?: string;
      sceneCount?: number;
    };

    const topic = typeof body.topic === "string" ? body.topic.trim() : "dark minimal brand";
    const brand = typeof body.brandName === "string" ? body.brandName.trim() : "";

    // Build cinematic dark prompts for 4 visual phases
    const brandDesc = brand ? `for brand "${brand}"` : "";
    const base = `cinematic photography ${brandDesc}, dark moody aesthetic, minimal composition, dramatic lighting, black background, high contrast, editorial fashion photography, 8K, no text, no logo`;

    const phasePrompts = [
      // Hook — something mysterious, identity-driven
      `${base}, extreme close-up of dark fabric texture, subtle grain, mystery and tension, ${topic}`,
      // Story — raw emotion, the brand's world
      `${base}, solitary figure in dark urban environment, city at night, neon reflections, streetwear aesthetic, ${topic}`,
      // Value — product, craft, detail
      `${base}, close-up macro shot of premium fabric stitching, dark luxury, craftsmanship detail, ${topic}`,
      // CTA — momentum, energy, movement
      `${base}, motion blur street photography, dark cityscape, headlights streaking, forward momentum, ${topic}`,
    ];

    // Generate all 4 images in parallel
    const images = await Promise.all(phasePrompts.map(p => generateBgImage(p)));

    return NextResponse.json({ images });
  } catch (err) {
    console.error("[kinetic/generate-images]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate images" },
      { status: 500 }
    );
  }
}
