import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fal } from "@fal-ai/client";
import { upload } from "@/lib/storage";
import { checkSpendLimit } from "@/lib/spend-guard";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { sanitizeAiStorySceneImagePrompt } from "@/lib/ai-story-character-style";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const FLUX_TEXT_TO_IMAGE = "fal-ai/flux/dev";

const COOKING_ACTION_TERMS = [
  "chop",
  "slice",
  "dice",
  "mince",
  "grate",
  "peel",
  "crack",
  "whisk",
  "stir",
  "saute",
  "fry",
  "sear",
  "simmer",
  "boil",
  "pour",
  "mix",
  "toss",
  "ladle",
  "plate",
  "garnish",
] as const;

const COOKING_INGREDIENT_TERMS = [
  "garlic",
  "ginger",
  "onion",
  "green onion",
  "scallion",
  "chili",
  "egg",
  "eggs",
  "noodle",
  "noodles",
  "broth",
  "stock",
  "soy sauce",
  "oil",
] as const;

function extractSceneTargets(text: string): { actions: string[]; ingredients: string[] } {
  const s = text.toLowerCase();
  const actions = COOKING_ACTION_TERMS.filter((t) => new RegExp(`\\b${t}\\w*\\b`, "i").test(s));
  const ingredients = COOKING_INGREDIENT_TERMS.filter((t) =>
    new RegExp(`\\b${t.replace(/\s+/g, "\\s+")}\\b`, "i").test(s)
  );
  return { actions, ingredients };
}

function buildCookingScenePrompt(params: {
  characterSeed: string;
  sceneComposition: string;
  dialogue: string;
}): string {
  const identity = params.characterSeed.trim();
  const comp = params.sceneComposition.trim();
  const line = params.dialogue.replace(/\r?\n/g, " ").trim();

  const lead =
    "Photorealistic cinematic cooking video still. One single frame, one moment in time. " +
    "PRIMARY SUBJECTS: food, ingredients, knives, cutting board, pot, pan, steam, oil sizzle, noodles, broth, bowls, utensils, and hands performing the cooking action. " +
    "Environment: cozy lived-in home kitchen with real materials and natural light. " +
    "The chef from the identity description may appear as needed: hands, forearms, partial profile, over-the-shoulder, or softly in background — never a centered arms-crossed presenter portrait or generic headshot. " +
    "Do NOT ignore the cooking action for a beauty shot of the host. No text, captions, logos, or watermarks. " +
    "No character sheet, collage, split screen, or multiple panels. " +
    "CRITICAL: image must depict exactly the same cooking step as this scene, not a nearby or generic step.";

  const merged = `${comp} ${line}`.trim();
  const targets = extractSceneTargets(merged);

  const parts = [lead];
  if (identity) {
    parts.push(`CHEF IDENTITY (same person in every scene; do not reinvent a new host): ${identity}`);
  }
  if (comp) {
    parts.push(`SCENE VISUAL (follow closely): ${comp}`);
  }
  if (line) {
    parts.push(`MOMENT FROM VOICEOVER (must match what is happening): ${line}`);
  }
  if (targets.actions.length > 0) {
    parts.push(
      `REQUIRED ACTIONS (must be visually obvious in this exact frame): ${targets.actions.join(", ")}.`
    );
  }
  if (targets.ingredients.length > 0) {
    parts.push(
      `REQUIRED INGREDIENTS (must be clearly visible if mentioned): ${targets.ingredients.join(", ")}.`
    );
  }
  if (targets.ingredients.length > 0) {
    parts.push(
      "STRICT MATCHING RULE: do not replace a mentioned ingredient with a different one. " +
        "Example: if garlic is mentioned, show garlic; do not substitute noodles unless noodles are explicitly mentioned in this scene."
    );
  }

  return sanitizeAiStorySceneImagePrompt(parts.join(" "));
}

/**
 * POST: Cooking scene still — FLUX text-to-image (no portrait img2img anchor so food/action can dominate).
 * Body: { sceneComposition: string, characterSeed?: string, dialogue?: string }
 * Returns { url: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;
    const rl = checkAiRateLimit(userId);
    if (rl) return rl;
    const sg = await checkSpendLimit("fal", userId);
    if (sg) return sg;

    const body = await request.json().catch(() => ({}));
    const sceneComposition =
      typeof body.sceneComposition === "string" ? body.sceneComposition.trim() : "";
    const characterSeed = typeof body.characterSeed === "string" ? body.characterSeed.trim() : "";
    const dialogue = typeof body.dialogue === "string" ? body.dialogue.trim() : "";

    if (!sceneComposition && !dialogue) {
      return NextResponse.json(
        { error: "sceneComposition or dialogue is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.FAL_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "FAL_API_KEY is not configured. Add it to .env.local or Vercel." },
        { status: 503 }
      );
    }

    fal.config({ credentials: apiKey });

    const prompt = buildCookingScenePrompt({
      characterSeed,
      sceneComposition: sceneComposition || dialogue,
      dialogue,
    });

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
      return NextResponse.json({ error: "Fal did not return an image URL" }, { status: 502 });
    }

    const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
    if (!useBlob) return NextResponse.json({ url: rawUrl });

    try {
      const imgRes = await fetch(rawUrl);
      if (!imgRes.ok) throw new Error("fetch scene image failed");
      const buf = Buffer.from(await imgRes.arrayBuffer());
      const pathname = `ai-cooking-video-scenes/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
      const blob = await upload(pathname, buf, {
        access: "public",
        contentType: "image/png",
        addRandomSuffix: false,
      });
      return NextResponse.json({ url: blob.url });
    } catch (e) {
      console.error("[ai-cooking-video/scene-image] Blob upload failed, returning fal URL:", e);
      return NextResponse.json({ url: rawUrl });
    }
  } catch (e) {
    console.error("[ai-cooking-video/scene-image]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
