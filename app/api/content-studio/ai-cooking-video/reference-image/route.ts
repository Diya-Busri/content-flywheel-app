import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fal } from "@fal-ai/client";
import { put } from "@vercel/blob";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const FLUX_TEXT_TO_IMAGE = "fal-ai/flux/dev";

function buildChefReferencePrompt(params: {
  chefType: string;
  cookingStyle: string;
  tone: string;
  lockedIdentitySeed?: string;
}): string {
  const chefType = params.chefType.trim() || "chef";
  const cookingStyle = params.cookingStyle.trim();
  const tone = params.tone.trim();
  const locked = params.lockedIdentitySeed?.trim();

  const context = [
    cookingStyle ? `Cooking style: ${cookingStyle}.` : "",
    tone ? `Tone: ${tone}.` : "",
    `Reference identity source: locked chef description must remain identical across all scenes.`,
  ]
    .filter(Boolean)
    .join(" ");

  const identityLine = locked
    ? `${locked}`
    : `A consistent photoreal chef identity (single person): ${chefType}, natural skin texture, realistic facial proportions, realistic eyes, realistic hair and hairstyle, realistic outfit and accessories.`;

  // Important: keep it strict: ONE person, no second character, no cartoon/3D/illustration language, no text.
  return (
    `Single photorealistic chef only, head-and-shoulders portrait, facing camera, neutral studio background, ` +
    `cinematic soft lighting, sharp focus on face, realistic skin texture. ` +
    `Render EXACTLY this same chef identity as described: ${identityLine}. ` +
    `Do NOT turn into a different person. Do NOT use cartoon, 3D, Pixar, illustration, stylized or fictional characters. ` +
    `No text, no logos, no watermark. ${context}`
  ).replace(/\s+/g, " ");
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;

    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const chefType = typeof body.chefType === "string" ? body.chefType.trim() : "";
    const cookingStyle = typeof body.cookingStyle === "string" ? body.cookingStyle.trim() : "";
    const tone = typeof body.tone === "string" ? body.tone.trim() : "";
    const lockedIdentitySeed = typeof body.lockedIdentitySeed === "string" ? body.lockedIdentitySeed.trim() : "";

    if (!chefType && !lockedIdentitySeed) {
      return NextResponse.json({ error: "chefType or lockedIdentitySeed is required" }, { status: 400 });
    }

    const apiKey = process.env.FAL_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ error: "FAL_API_KEY is not configured. Add it to .env.local or Vercel." }, { status: 503 });
    }

    fal.config({ credentials: apiKey });

    const prompt = buildChefReferencePrompt({ chefType, cookingStyle, tone, lockedIdentitySeed });

    const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
    const result = await fal.subscribe(FLUX_TEXT_TO_IMAGE, {
      input: {
        prompt,
        image_size: "square_hd",
        num_images: 1,
        output_format: "png",
        enable_safety_checker: true,
      },
      logs: false,
    });

    const data = result.data as { images?: { url?: string }[] };
    const rawUrl = data?.images?.[0]?.url;
    if (!rawUrl || typeof rawUrl !== "string") {
      return NextResponse.json({ error: "Fal did not return a reference image URL" }, { status: 502 });
    }

    if (!useBlob) return NextResponse.json({ referenceUrl: rawUrl });

    try {
      const imgRes = await fetch(rawUrl);
      if (!imgRes.ok) throw new Error("fetch ref image failed");
      const buf = Buffer.from(await imgRes.arrayBuffer());
      const pathname = `ai-cooking-video-refs/${userId}/${Date.now()}-chef.png`;
      const blob = await put(pathname, buf, {
        access: "public",
        contentType: "image/png",
        addRandomSuffix: false,
      });
      return NextResponse.json({ referenceUrl: blob.url });
    } catch (e) {
      // Fall back to fal URL if blob upload fails.
      return NextResponse.json({ referenceUrl: rawUrl });
    }
  } catch (e) {
    console.error("[ai-cooking-video/reference-image]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}

