import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";
import { sanitizeAiStorySceneImagePrompt } from "@/lib/ai-story-character-style";
import {
  generateStoryCharacterSeed,
  prependCharacterSeedToSceneImagePrompts,
} from "@/lib/story-character-seed";

export const dynamic = "force-dynamic";

export type AiCookingScene = {
  sceneNumber: number;
  dialogue: string;
  imagePrompt: string;
  motionPrompt: string;
};

const CHEF_TYPES = [
  "Home Cook",
  "Pro Chef",
  "Grandma Style",
  "Street Food Vendor",
  "Anime Chef",
] as const;
const COOKING_STYLES = [
  "Cozy Home Kitchen",
  "Fast TikTok Recipe",
  "Luxury Fine Dining",
  "Street Food Energy",
] as const;
const TONES = ["Satisfying", "Wholesome", "Hyped", "Calm ASMR"] as const;

const COOKING_SCENE_COUNT_MIN = 8;
const COOKING_SCENE_COUNT_MAX = 16;

function clampCookingSceneCount(n: number): number {
  return Math.min(
    COOKING_SCENE_COUNT_MAX,
    Math.max(COOKING_SCENE_COUNT_MIN, Math.floor(n))
  );
}

/** Default: let the model choose length; explicit number fixes length. */
function isAutoSceneCount(body: Record<string, unknown>): boolean {
  const v = body.scene_count ?? body.sceneCount;
  if (v === undefined || v === null) return true;
  if (typeof v === "string" && v.trim().toLowerCase() === "auto") return true;
  return false;
}

function parseFixedSceneCount(body: Record<string, unknown>): number | null {
  const v = body.scene_count ?? body.sceneCount;
  if (typeof v === "number" && Number.isFinite(v)) return clampCookingSceneCount(v);
  if (typeof v === "string" && /^\d+$/.test(v.trim())) {
    return clampCookingSceneCount(parseInt(v.trim(), 10));
  }
  return null;
}

function extractRawScenesArray(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (
    parsed &&
    typeof parsed === "object" &&
    Array.isArray((parsed as { scenes?: unknown[] }).scenes)
  ) {
    return (parsed as { scenes: unknown[] }).scenes;
  }
  return [];
}

function applyOpeningHookToScenes(
  scenes: AiCookingScene[],
  openingHook: string
): AiCookingScene[] {
  const hook = openingHook.trim();
  if (!hook || scenes.length === 0) return scenes;
  return scenes.map((scene, i) => {
    if (i !== 0) return scene;
    const dialogue = scene.dialogue.trim();
    if (!dialogue) {
      return { ...scene, dialogue: hook };
    }
    if (dialogue.toLowerCase().startsWith(hook.toLowerCase())) {
      return scene;
    }
    return { ...scene, dialogue: `${hook} ${dialogue}`.trim() };
  });
}

function applyCookingFocusToScenes(scenes: AiCookingScene[]): AiCookingScene[] {
  const focusPrefix =
    "Food-first composition: dish, ingredients, pan/pot, and hands are the primary subjects. " +
    "Keep the SAME CHEF identity across all scenes. If the chef appears, keep their face visible at least partially (eyes/hair) and keep hairstyle, outfit, and accessories unchanged. " +
    "Avoid portrait-style face-centric framing; chef can be background/partial, but NEVER switch to a different person.";
  return scenes.map((scene) => ({
    ...scene,
    imagePrompt: sanitizeAiStorySceneImagePrompt(`${focusPrefix} ${scene.imagePrompt}`),
  }));
}

function mapRawRowsToScenes(raw: unknown[], take: number): AiCookingScene[] {
  return raw.slice(0, take).map((s: unknown, i: number) => {
    const row = s as Record<string, unknown>;
    const voiceover =
      typeof row.voiceover === "string" ? String(row.voiceover).trim() : "";
    const dialogueRaw =
      typeof row.dialogue === "string" ? String(row.dialogue).trim() : "";
    const spoken = voiceover || dialogueRaw;
    const rawIp =
      typeof row.image_prompt === "string"
        ? String(row.image_prompt).trim()
        : typeof row.imagePrompt === "string"
          ? String(row.imagePrompt).trim()
          : "";
    return {
      sceneNumber: i + 1,
      dialogue: spoken,
      imagePrompt: sanitizeAiStorySceneImagePrompt(rawIp),
      motionPrompt:
        typeof row.motion_prompt === "string"
          ? String(row.motion_prompt).trim()
          : typeof row.motionPrompt === "string"
            ? String(row.motionPrompt).trim()
            : "",
    };
  });
}

/**
 * POST: Generate AI Cooking Video scenes (same client shape as AI Story).
 * Body: { chef_type, dish_name, cooking_style, tone, episode_number,
 *   scene_count?: "auto" | number (8–16). Omitted = auto — model picks 8–16 from recipe complexity. }
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

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const autoSceneCount = isAutoSceneCount(body);
    const fixedSceneCount = autoSceneCount ? null : parseFixedSceneCount(body) ?? 12;
    const chefTypeRaw =
      typeof body.chef_type === "string" ? String(body.chef_type).trim() : "";
    const chefType = CHEF_TYPES.includes(chefTypeRaw as (typeof CHEF_TYPES)[number])
      ? chefTypeRaw
      : "Home Cook";
    const dishName = typeof body.dish_name === "string" ? body.dish_name.trim() : "";
    const cookingStyle =
      typeof body.cooking_style === "string" &&
      COOKING_STYLES.includes(body.cooking_style as (typeof COOKING_STYLES)[number])
        ? body.cooking_style
        : "Cozy Home Kitchen";
    const tone =
      typeof body.tone === "string" && TONES.includes(body.tone as (typeof TONES)[number])
        ? body.tone
        : "Satisfying";
    const episodeNumber =
      typeof body.episode_number === "number" && body.episode_number >= 1
        ? Math.floor(body.episode_number)
        : typeof body.episodeNumber === "number" && body.episodeNumber >= 1
          ? Math.floor(body.episodeNumber)
          : 1;
    const openingHook =
      typeof body.opening_hook === "string"
        ? body.opening_hook.trim()
        : typeof body.openingHook === "string"
          ? body.openingHook.trim()
          : "";

    if (!dishName) {
      return NextResponse.json(
        { error: "dish_name is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI is not configured. Add OPENAI_API_KEY." },
        { status: 503 }
      );
    }

    const sharedRecipeRules = `Your episode must walk through REAL RECIPE STEPS for the given dish in chronological order — not random beauty shots. Every scene is one distinct cooking moment you would not skip in an honest tutorial (prep → heat → build flavors → cook through → finish → serve).

Typical beat order to spread across scenes (merge/split as needed; never skip this dish’s critical techniques):
1) Hook + promise; hero ingredients / mise en place
2) Prep: wash, chop, slice aromatics or veg
3) Heat pan/pot; fat if needed
4) Bloom aromatics / toast spices / fry paste until fragrant
5) Liquid for broth or sauce; seasoning
6) Simmer / reduce / develop depth
7) Protein or second major layer (if applicable)
8) Starch: noodles, rice, blanch — steam and water action
9) Combine: ladle, toss, merge in pan or bowl
10) Taste / adjust if room
11) Bowl or plate assembly
12) Garnish and finishing touches
13+) Extra scenes only for multi-stage dishes: strain, rest, second garnish, etc.
Last scene ALWAYS: satisfying final hero shot of the finished dish.

Each scene object must include:
- scene_number (number, sequential from 1)
- title (string, short chapter title)
- dialogue (string, optional; may be empty if voiceover carries the script)
- image_prompt (string, detailed still frame; no text or lettering in the image)
- voiceover (string, ~5 seconds spoken, natural; primary script audio)

Rules:
- voiceover is main narration; dialogue optional complement.
- image_prompt: one cinematic still only (no panels, grids, multi-frame).
- Each image_prompt must match THAT step — never copy the same generic line across scenes.
- Food is the hero; avoid full portrait shots of the chef; same chef identity if they appear.
- If opening_hook is provided, scene 1 voiceover/dialogue must start with that exact hook text.`;

    const systemPromptAuto = `You are a writer for short-form AI cooking videos.

Decide how many distinct visual steps this SPECIFIC dish needs: an integer scene_count between ${COOKING_SCENE_COUNT_MIN} and ${COOKING_SCENE_COUNT_MAX} inclusive.
- ${COOKING_SCENE_COUNT_MIN}–9: very simple / few ingredients
- 10–12: standard home recipe
- 13–${COOKING_SCENE_COUNT_MAX}: multi-stage (e.g. ramen from scratch, long simmers, many components) where a shorter video would skip real technique

Return ONLY valid JSON of this exact shape:
{ "scene_count": <integer>, "scenes": [ ... exactly scene_count objects ... ] }

${sharedRecipeRules}

Return exactly scene_count scene objects — no fewer, no more.`;

    const systemPromptFixed = `You are a writer for short-form AI cooking videos.

Generate exactly ${fixedSceneCount} scenes as JSON with top-level key "scenes" (array of exactly ${fixedSceneCount} objects).

${sharedRecipeRules}

Return ONLY valid JSON. Prefer shape: { "scenes": [ ... ${fixedSceneCount} objects ... ] }. A bare array is also accepted by the parser.`;

    const systemPrompt = autoSceneCount ? systemPromptAuto : systemPromptFixed;

    const userPromptAuto = `chef_type: ${chefType}
dish_name: ${dishName}
cooking_style: ${cookingStyle}
tone: ${tone}
episode_number: ${episodeNumber}
scene_count: auto (you choose ${COOKING_SCENE_COUNT_MIN}-${COOKING_SCENE_COUNT_MAX} based on the dish)
opening_hook: ${openingHook || "(none)"}

Write the episode now with the chosen scene_count and full scenes array.`;

    const userPromptFixed = `chef_type: ${chefType}
dish_name: ${dishName}
cooking_style: ${cookingStyle}
tone: ${tone}
episode_number: ${episodeNumber}
scene_count: ${fixedSceneCount} (fixed)
opening_hook: ${openingHook || "(none)"}

Generate exactly ${fixedSceneCount} scenes now.`;

    const userPrompt = autoSceneCount ? userPromptAuto : userPromptFixed;

    const response = await fetchOpenAIWithRetry(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.75,
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json(
        { error: "AI request failed", details: err },
        { status: 502 }
      );
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: "No AI response" }, { status: 502 });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: "Invalid AI response format" },
        { status: 502 }
      );
    }

    const raw = extractRawScenesArray(parsed);
    let take: number;
    if (autoSceneCount) {
      if (raw.length < COOKING_SCENE_COUNT_MIN) {
        return NextResponse.json(
          {
            error: `AI returned too few scenes (${raw.length}); need at least ${COOKING_SCENE_COUNT_MIN}. Try Generate again.`,
          },
          { status: 502 }
        );
      }
      take = Math.min(raw.length, COOKING_SCENE_COUNT_MAX);
    } else {
      const n = fixedSceneCount!;
      if (raw.length < n) {
        return NextResponse.json(
          {
            error: `AI returned ${raw.length} scenes but ${n} were requested; try Generate again.`,
          },
          { status: 502 }
        );
      }
      take = n;
    }

    let scenes = mapRawRowsToScenes(raw, take);
    scenes = applyOpeningHookToScenes(scenes, openingHook);
    scenes = applyCookingFocusToScenes(scenes);

    const character_seed = await generateStoryCharacterSeed(apiKey, {
      characterTypesLine: chefType,
      themeOrBuilding: dishName,
      templateName: "AI Cooking Video",
      flavorLine: `${cookingStyle}, ${tone}`,
    });
    scenes = prependCharacterSeedToSceneImagePrompts(scenes, character_seed);

    const hashtags = [
      "#AICooking",
      "#CookingVideo",
      "#FoodTok",
      "#RecipeReel",
      "#CinematicFood",
      "#SatisfyingCooking",
      "#HomeCooking",
      "#ChefLife",
      "#AIGenerated",
      "#ShortFormVideo",
      "#Reels",
      "#TikTok",
      "#CookingInspo",
      "#FoodContent",
      "#ContentCreator",
    ];
    const socialMediaPack = {
      caption: `Episode ${episodeNumber}: ${dishName} in ${cookingStyle} style. 🍳✨`,
      title: `Episode ${episodeNumber}: ${dishName} (${tone})`,
      hashtags,
      youtubeDescription: `A ${tone.toLowerCase()} AI cooking short featuring ${dishName} in ${cookingStyle} style with a ${chefType.toLowerCase()} lead. ${scenes.length} scenes walking through real recipe steps from prep to the final plated reveal.`,
    };

    return NextResponse.json({
      scenes,
      socialMediaPack,
      characterStyle: "",
      character_seed,
      scene_count: scenes.length,
      scene_count_mode: autoSceneCount ? "auto" : "fixed",
    });
  } catch (e) {
    console.error("[generate/ai-cooking-video]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
