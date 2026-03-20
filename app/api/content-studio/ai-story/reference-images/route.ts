import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fal } from "@fal-ai/client";
import { put } from "@vercel/blob";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { parseCharacterTypes } from "@/lib/ai-story-character-style";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const FLUX_TEXT_TO_IMAGE = "fal-ai/flux/dev";

function buildReferencePrompt(characterType: string, theme: string): string {
  const t = characterType.trim();
  const mood = theme.trim() ? ` Mood aligned with: ${theme.trim()}.` : "";
  return (
    `Single character only, full body, neutral standing pose, facing forward, plain white background, soft even studio lighting, centered in frame. ` +
    `NOT a character sheet, NOT a sprite sheet, NOT multiple poses, NOT a grid, NOT panels — one figure, one pose, one image only. ` +
    `Stylized 3D cartoon ${t} character, consistent design for a single identity reference portrait. ` +
    `No other characters, no text, no logos, no watermark.${mood}`
  ).replace(/\s+/g, " ");
}

/**
 * POST: One FLUX dev text-to-image reference portrait per character type (fal.ai).
 * Body: { characters: string, theme?: string }
 * Returns { referenceUrls: Record<string, string> }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;
    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const characters = typeof body.characters === "string" ? body.characters.trim() : "";
    const theme = typeof body.theme === "string" ? body.theme.trim() : "";

    const types = parseCharacterTypes(characters);
    if (types.length === 0) {
      return NextResponse.json({ error: "characters must list at least one type" }, { status: 400 });
    }

    const apiKey = process.env.FAL_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "FAL_API_KEY is not configured. Add it to .env.local or Vercel." },
        { status: 503 }
      );
    }

    fal.config({ credentials: apiKey });

    const referenceUrls: Record<string, string> = {};
    const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

    for (const t of types) {
      const result = await fal.subscribe(FLUX_TEXT_TO_IMAGE, {
        input: {
          prompt: buildReferencePrompt(t, theme),
          image_size: "square_hd",
          num_images: 1,
          output_format: "png",
          enable_safety_checker: true,
        },
        logs: false,
      });

      const data = result.data as {
        images?: { url?: string }[];
      };
      const rawUrl = data?.images?.[0]?.url;
      if (!rawUrl || typeof rawUrl !== "string") {
        console.error("[reference-images] Missing image URL for", t, result);
        continue;
      }

      if (useBlob) {
        try {
          const imgRes = await fetch(rawUrl);
          if (!imgRes.ok) throw new Error("fetch ref image failed");
          const buf = Buffer.from(await imgRes.arrayBuffer());
          const pathname = `ai-story-refs/${userId}/${Date.now()}-${t.replace(/\s+/g, "-")}.png`;
          const blob = await put(pathname, buf, {
            access: "public",
            contentType: "image/png",
            addRandomSuffix: false,
          });
          referenceUrls[t] = blob.url;
        } catch (e) {
          console.error("[reference-images] Blob upload failed, using fal URL:", e);
          referenceUrls[t] = rawUrl;
        }
      } else {
        referenceUrls[t] = rawUrl;
      }
    }

    if (Object.keys(referenceUrls).length === 0) {
      return NextResponse.json(
        { error: "Could not generate any reference images. Check FAL_API_KEY and try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({ referenceUrls });
  } catch (e) {
    console.error("[content-studio/ai-story/reference-images]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
