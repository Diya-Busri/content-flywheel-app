import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const FAL_API_KEY = () => process.env.FAL_API_KEY?.trim() ?? "";

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const body = (await request.json().catch(() => ({}))) as {
      scenes?: Array<{ visualDescription?: string }>;
    };

    const scenes = Array.isArray(body.scenes) ? body.scenes : [];
    if (scenes.length === 0) return NextResponse.json({ error: "No scenes provided" }, { status: 400 });

    // Generate all scene images in parallel (max 4 concurrent) for speed
    const CONCURRENCY = 4;
    const imageUrls: string[] = new Array(scenes.length).fill("");

    const generateOne = async (i: number): Promise<void> => {
      const visualDescription = scenes[i]?.visualDescription ?? "";
      const prompt = `2D cartoon animation style, stickman characters with large round circle heads and simple black stick bodies, colorful illustrated background scene, flat color environment with buildings trees and sky, story animation art style similar to kurzgesagt or draw my life, ${visualDescription}, vibrant pastel colors, clean cartoon illustration, no text, no watermark`;

      try {
        const res = await fetch("https://fal.run/fal-ai/flux/schnell", {
          method: "POST",
          headers: {
            Authorization: `Key ${FAL_API_KEY()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt,
            image_size: "portrait_4_3",
            num_inference_steps: 4,
            num_images: 1,
            enable_safety_checker: true,
          }),
          signal: AbortSignal.timeout(30_000),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => "unknown");
          console.error(`[stickman-story/generate-images] fal.ai scene ${i + 1} failed: ${errText}`);
          return;
        }

        const data = (await res.json()) as { images?: Array<{ url: string }> };
        imageUrls[i] = data.images?.[0]?.url ?? "";
      } catch (err) {
        console.error(`[stickman-story/generate-images] scene ${i + 1} error:`, err);
      }
    };

    // Process in batches of CONCURRENCY
    for (let batch = 0; batch < scenes.length; batch += CONCURRENCY) {
      const batchIndices = Array.from({ length: Math.min(CONCURRENCY, scenes.length - batch) }, (_, k) => batch + k);
      await Promise.all(batchIndices.map(generateOne));
    }

    return NextResponse.json({ imageUrls });
  } catch (err) {
    console.error("[templates/stickman-story/generate-images]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate images" },
      { status: 500 }
    );
  }
}
