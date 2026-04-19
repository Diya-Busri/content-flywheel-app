import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { checkVideoCredits, deductVideoCredit } from "@/actions/video-credits-actions";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";
import { sanitizeAiStorySceneImagePrompt } from "@/lib/ai-story-character-style";
import {
  generateStoryCharacterSeed,
  prependCharacterSeedToSceneImagePrompts,
} from "@/lib/story-character-seed";

export const dynamic = "force-dynamic";

export type SatisfyingBuildScene = {
  sceneNumber: number;
  dialogue: string;
  imagePrompt: string;
  motionPrompt: string;
};

const CHARACTER_TYPES = ["Person", "Fruit Character", "Robot", "Animal", "Tech Gadget"] as const;
const BUILD_STYLES = [
  "Miniature Construction",
  "Giant Object Build",
  "Impossible Engineering",
  "Cozy Cottage Build",
] as const;
const TONES = ["Satisfying", "Dramatic", "Wholesome", "Chaotic"] as const;

function applyOpeningHookToScenes(
  scenes: SatisfyingBuildScene[],
  openingHook: string
): SatisfyingBuildScene[] {
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

function normalizeScenesFromParsed(parsed: unknown): SatisfyingBuildScene[] {
  let raw: unknown[] = [];
  if (Array.isArray(parsed)) {
    raw = parsed;
  } else if (
    parsed &&
    typeof parsed === "object" &&
    Array.isArray((parsed as { scenes?: unknown[] }).scenes)
  ) {
    raw = (parsed as { scenes: unknown[] }).scenes;
  }
  return raw.slice(0, 8).map((s: unknown, i: number) => {
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
    const sceneNum =
      typeof row.scene_number === "number" && row.scene_number >= 1
        ? row.scene_number
        : typeof row.sceneNumber === "number" && row.sceneNumber >= 1
          ? row.sceneNumber
          : i + 1;
    return {
      sceneNumber: sceneNum,
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
 * POST: Generate 8 Satisfying Build scenes (same client shape as AI Story).
 * Body: { character_type, what_building, build_style, tone, episode_number }
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

    const { hasCredits, balance } = await checkVideoCredits("brandStoryVideo");
    if (!hasCredits) {
      return NextResponse.json(
        { error: "You need 1 video credit to generate a satisfying build script.", code: "NO_VIDEO_CREDITS", balance, redirectTo: "/dashboard/video-credits" },
        { status: 402 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const characterTypeRaw =
      typeof body.character_type === "string" ? body.character_type.trim() : "";
    const characterType = CHARACTER_TYPES.includes(
      characterTypeRaw as (typeof CHARACTER_TYPES)[number]
    )
      ? characterTypeRaw
      : "Person";
    const whatBuilding =
      typeof body.what_building === "string" ? body.what_building.trim() : "";
    const buildStyle =
      typeof body.build_style === "string" && body.build_style.trim().length > 0
        ? body.build_style.trim()
        : "Miniature Construction";
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
    const imageStyle =
      typeof body.image_style === "string" ? body.image_style.trim() : "Miniature/Stylized";
    const isRealisticPhoto = imageStyle === "Realistic Photography" || buildStyle === "Construction Time-lapse";
    const isTransformation = buildStyle === "Transformation";
    const isTimelapse = buildStyle === "Construction Time-lapse";

    if (!whatBuilding) {
      return NextResponse.json(
        { error: "what_building is required" },
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

    const sceneStructure = isTimelapse
      ? `- Scene 1: empty site / raw starting materials — establishes the scale and setting
- Scenes 2–3: groundwork and foundations being laid
- Scenes 4–5: main structure or core build taking visible shape
- Scenes 6–7: finishing details, final touches, craftsmanship close-ups
- Scene 8: completed build in full — wide beauty shot showing the finished result`
      : isTransformation
      ? `- Scenes 1–2: BEFORE — show the starting point or current state in full detail; establish what exists before transformation begins
- Scenes 3–6: DURING — show the transformation actively happening; each scene captures a distinct stage of progress
- Scenes 7–8: AFTER — reveal the final result; scene 8 is a side-by-side or direct comparison showing how dramatically things have changed`
      : `- Scene 1: character arrives or finds the project site
- Scenes 2–7: progressive build steps
- Scene 8: big reveal of the finished build`;

    const imagePromptStyle = isTimelapse
      ? `Image prompt style — CONSTRUCTION TIME-LAPSE (real people, real builds):
- Every image prompt must look like a real photo taken on-site during an actual construction project.
- Use documentary/GoPro/drone photography language: "wide-angle site photograph", "golden hour construction photo", "drone aerial shot", "close-up of hands working", "workers in hi-vis vests", "muddy boots", "raw timber", "concrete pour", "steel framing", etc.
- People should be actively working — digging, hammering, laying, cutting, measuring.
- Environment should feel real: weather, dirt, dust, scaffolding, power tools, materials stacked on site.
- Never mention cartoon, illustration, miniature, toy, stylized, or 3D render.
- No character seeds or fictional characters — these are real anonymous construction workers.`
      : isRealisticPhoto
      ? `Image prompt style — REALISTIC PHOTOGRAPHY:
- Write image prompts as real-world photographic scenes, NOT cartoon, miniature, toy, or illustrated.
- Use photography language: "DSLR photograph", "natural daylight", "shallow depth of field", "photorealistic", "cinematic still frame", "film grain", "golden hour light", etc.
- Describe real materials, textures, and environments exactly as they would appear in a photograph.
- Never mention "miniature", "tiny", "Lego", "cartoon", "3D render", "illustration", or "stylized".`
      : `Image prompt style — STYLIZED/MINIATURE (default):
- Write image prompts in a stylized, cinematic, miniature-world aesthetic appropriate for the build_style.
- May reference miniature scale, toy-like quality, stop-motion feel, or stylized rendering as fits the scene.`;

    const dialogueRule = isTimelapse
      ? `- dialogue and voiceover may both be left empty — this style works as pure visuals with music. Only add text if the opening_hook is set.`
      : `- voiceover should be the main narration; if dialogue is used, it should complement voiceover, not contradict it.`;

    const systemPrompt = `You are a writer for satisfying build short-form videos.

Generate exactly 8 scenes as a JSON object (use a top-level key "scenes" whose value is an array of 8 objects).

Scene structure:
${sceneStructure}

Each scene object must include:
- scene_number (number, 1–8)
- title (string, short chapter title)
- dialogue (string, optional on-screen line; leave empty for time-lapse style)
- image_prompt (string, detailed still-frame image description for image generation; no text or lettering in the image)
- voiceover (string, spoken narration for ~5 seconds; leave empty for time-lapse/no-voiceover style)

Apply these inputs consistently across all scenes:
- character_type
- what_building
- build_style
- tone
- episode_number
- opening_hook (optional)

${imagePromptStyle}

Rules:
- ${dialogueRule}
- image_prompt must describe one single cinematic still (no panels, grids, or multi-frame layouts).
- If opening_hook is provided, scene 1 voiceover/dialogue must start with that exact hook text.

Return ONLY valid JSON. Prefer shape: { "scenes": [ ... 8 objects ... ] }. If you return a bare array, it will also be accepted by the parser.`;

    const userPrompt = `character_type: ${characterType}
what_building: ${whatBuilding}
build_style: ${buildStyle}
tone: ${tone}
image_style: ${imageStyle}
episode_number: ${episodeNumber}
opening_hook: ${openingHook || "(none)"}

Generate the 8-scene satisfying build episode now.`;

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

    let scenes = normalizeScenesFromParsed(parsed);
    scenes = applyOpeningHookToScenes(scenes, openingHook);

    // Time-lapse style has no fictional character — skip identity lock seed
    if (!isTimelapse) {
      const character_seed = await generateStoryCharacterSeed(apiKey, {
        characterTypesLine: characterType,
        themeOrBuilding: whatBuilding,
        templateName: "Satisfying Build",
        flavorLine: `${buildStyle}, ${tone}`,
      });
      scenes = prependCharacterSeedToSceneImagePrompts(scenes, character_seed);
    }

    const hashtags = [
      "#SatisfyingBuild",
      "#OddlySatisfying",
      "#MiniBuild",
      "#ASMRBuild",
      "#AIGenerated",
      "#ShortForm",
      "#Reels",
      "#TikTok",
      "#BuildInPublic",
      "#CreativeProcess",
      "#StopMotionVibes",
      "#TinyWorld",
      "#CraftTok",
      "#EngineeringArt",
      "#ContentCreator",
    ];
    const socialMediaPack = {
      caption: `Episode ${episodeNumber}: ${whatBuilding} — ${buildStyle} energy. 🔨✨`,
      title: `Episode ${episodeNumber}: ${whatBuilding} (${tone}) 🎬`,
      hashtags,
      youtubeDescription: `A ${tone.toLowerCase()} satisfying build: ${whatBuilding} in ${buildStyle} style with a ${characterType.toLowerCase()} lead. Eight scenes from arrival to the final reveal.`,
    };

    await deductVideoCredit("brandStoryVideo").catch((e) => console.error("[satisfying-build] credit deduction failed:", e));
    return NextResponse.json({
      scenes,
      socialMediaPack,
      characterStyle: "",
      character_seed,
    });
  } catch (e) {
    console.error("[generate/satisfying-build]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
