import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
      character?: string;
    };

    const scenes = Array.isArray(body.scenes) ? body.scenes : [];
    if (scenes.length === 0) return NextResponse.json({ error: "No scenes provided" }, { status: 400 });

    const character = typeof body.character === "string" ? body.character.trim() : "a young protagonist";

    const imageUrls: string[] = [];

    for (let i = 0; i < scenes.length; i++) {
      if (i > 0) await sleep(400);

      const visualDescription = scenes[i]?.visualDescription ?? "";
      const prompt = `anime illustration, cel-shaded, Studio Ghibli inspired, ${character}, ${visualDescription}, cinematic lighting, detailed background, 9:16 vertical composition, clean line art, warm soft colors`;

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
        const errText = await res.text().catch(() => "unknown");
        console.error(`[templates/anime-story/generate-images] fal.ai scene ${i + 1} failed: ${errText}`);
        imageUrls.push("");
        continue;
      }

      const data = (await res.json()) as { images?: Array<{ url: string }> };
      const url = data.images?.[0]?.url ?? "";
      imageUrls.push(url);
    }

    return NextResponse.json({ imageUrls });
  } catch (err) {
    console.error("[templates/anime-story/generate-images]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate images" },
      { status: 500 }
    );
  }
}
