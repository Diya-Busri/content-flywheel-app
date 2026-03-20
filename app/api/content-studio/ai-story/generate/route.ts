import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";
import {
  AI_STORY_GLOBAL_VISUAL_STYLE,
  mergeCharacterLocksIntoImagePrompt,
  parseCharacterTypes,
  sanitizeAiStorySceneImagePrompt,
} from "@/lib/ai-story-character-style";

export const dynamic = "force-dynamic";

export type AiStoryScene = {
  sceneNumber: number;
  dialogue: string;
  imagePrompt: string;
  motionPrompt: string;
};

export type AiStorySocialMediaPack = {
  caption: string;
  title: string;
  hashtags: string[];
  youtubeDescription: string;
};

const STORY_STYLES = ["Brainrot", "Classic Dramatic", "Dark & Twisted", "Wholesome"] as const;


/**
 * POST: Generate 8 AI Story scenes using GPT-4o.
 * Body: { characters, characterNames?, theme, tone, style?, episodeNumber }
 * Returns { scenes: AiStoryScene[] }
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
    const characters =
      typeof body.characters === "string" ? body.characters.trim() : "";
    const characterNames =
      typeof body.characterNames === "string" ? body.characterNames.trim() : "";
    const theme = typeof body.theme === "string" ? body.theme.trim() : "";
    const tone =
      typeof body.tone === "string" &&
      ["Sad", "Dramatic", "Shocking"].includes(body.tone)
        ? body.tone
        : "Dramatic";
    const episodeNumber =
      typeof body.episodeNumber === "number" && body.episodeNumber >= 1
        ? Math.floor(body.episodeNumber)
        : 1;
    const style =
      typeof body.style === "string" && STORY_STYLES.includes(body.style as (typeof STORY_STYLES)[number])
        ? (body.style as (typeof STORY_STYLES)[number])
        : "Brainrot";

    const characterStyleRegistry =
      body.characterStyleRegistry &&
      typeof body.characterStyleRegistry === "object" &&
      !Array.isArray(body.characterStyleRegistry)
        ? (body.characterStyleRegistry as Record<string, string>)
        : null;

    const consistencyMode =
      body.consistencyMode === "img2img" ? ("img2img" as const) : ("text" as const);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI is not configured. Add OPENAI_API_KEY." },
        { status: 503 }
      );
    }

    const styleInstructions: Record<(typeof STORY_STYLES)[number], string> = {
      Brainrot: `CHARACTER NAMES: Automatically give each character a brainrot/Gen Z style name based on their fruit or object type. Examples: Banana → "Skibidi Banana", "No Cap Nana", "Rizz Banana"; Strawberry → "Sigma Berry", "Gyatt Strawberry"; Cherry → "Based Cherry", "Bussin Cherry". Apply this pattern to whatever characters the user provides: combine a Gen Z/brainrot word with their type.

DIALOGUE STYLE: Write all dialogue in brainrot Gen Z slang. Use words and phrases like: no cap, fr fr, bussin, rizz, slay, gyatt, skibidi, sigma, based, lowkey, highkey, ngl, mid, touch grass, L + ratio. Keep the dramatic soap opera storyline (betrayal, secrets, confrontations, cliffhangers) but express it in this style. Dialogue format: "CharacterName: line" (use the brainrot name you gave them).`,

      "Classic Dramatic": `CHARACTER NAMES: Use the character names/types the user provides as-is, or give them classic soap opera style names (e.g. elegant, dramatic first names or "The [Noun]").

DIALOGUE STYLE: Write dialogue in classic soap opera style—melodramatic, emotional, full of tension and revelation. No slang. Use formal-to-melodramatic language, dramatic pauses, and classic tropes (betrayal, secret pasts, confrontations, cliffhangers). Dialogue format: "CharacterName: line".`,

      "Dark & Twisted": `CHARACTER NAMES: Use the character names/types the user provides; give them a slight edge (e.g. cold, mysterious, or unsettling nicknames or titles if it fits).

DIALOGUE STYLE: Write dialogue in psychological thriller / dark soap style. Unsettling, ambiguous, morally grey. Suggest manipulation, hidden motives, gaslighting, and tension. Keep it gripping but not gratuitously violent. Dialogue format: "CharacterName: line".`,

      Wholesome: `CHARACTER NAMES: Use the character names/types the user provides; keep names friendly and approachable (e.g. cute, warm, or family-friendly variants).

DIALOGUE STYLE: Write dialogue in heartwarming, family-friendly soap style. Focus on forgiveness, growth, support, and emotional connection. No cruelty or harsh language. Uplifting and hopeful even when there's conflict. Dialogue format: "CharacterName: line".`,
    };

    const styleBlock = styleInstructions[style];
    const dialoguePart = styleBlock.includes("DIALOGUE STYLE:")
      ? "DIALOGUE STYLE:" + styleBlock.split("DIALOGUE STYLE:")[1]
      : styleBlock;
    const characterNamesInstruction = characterNames
      ? `CHARACTER NAMES: Use these exact names in the story (in order, matching the character types): ${characterNames}. Use them exactly as written in all dialogue with "CharacterName: line" format. Do not invent or change any names.

${dialoguePart}`
      : null;

    const imagePromptLockNote =
      characterStyleRegistry || consistencyMode === "img2img"
        ? `

IMAGE PROMPT RULES (scene + action only): Character appearance comes from separate reference images, not from this text. In imagePrompt, describe ONLY the scene: setting, lighting, camera angle, action, props, and what happens — not the character's colors, face shape, body, or art style. Still no text in the image.`
        : "";

    const imagePromptSingleFrameRules = `

Never use or imply in imagePrompt: character sheet, sprite sheet, multiple poses in one image, pose sheet, turnaround sheet, grid layout, tiled composition, comic panels, storyboard panels, or reference sheet. imagePrompt must describe exactly ONE single moment — one cohesive still frame, not a layout of several figures or panels.`;

    const systemPrompt = `You are a scriptwriter for short-form AI story episodes. Generate exactly 8 scenes for one episode.

STYLE: ${style}
${characterNamesInstruction ?? styleBlock}

DIALOGUE LENGTH: Each scene is exactly one 5-second slot with voiceover. After the "CharacterName: " prefix, the spoken line must be 25-35 words. Write natural conversational speech that sounds like someone actually talking out loud, with full phrasing and rhythm (not clipped fragments).

For each scene you must output:
- sceneNumber: 1 through 8
- dialogue: what the characters say in this scene, with "CharacterName: " prefix; the line after the prefix must be 25-35 words of natural conversational speech
- imagePrompt: a detailed image description for generating a still image (setting, mood, composition; no text)${imagePromptLockNote}${imagePromptSingleFrameRules}
- motionPrompt: a short description for how the scene could animate or move (e.g. "slow zoom on face", "text fades in")

Also return socialMediaPack generated from the same story:
- caption: punchy 1-2 lines with emojis for TikTok/Instagram
- title: episode-style title with emojis (e.g. "Episode 1: The Cheating Scandal 🍌🍓")
- hashtags: array of 15-20 relevant hashtags for AI story content
- youtubeDescription: 3-4 sentence episode summary for YouTube

Return a JSON object with:
- scenes: array of exactly 8 objects, each with sceneNumber (number), dialogue (string), imagePrompt (string), motionPrompt (string)
- socialMediaPack: object with caption (string), title (string), hashtags (string[]), youtubeDescription (string)

Output only valid JSON, no markdown, no explanation.`;

    const userPrompt = `Character types: ${characters || "(none specified)"}
${characterNames ? `Character names (use exactly): ${characterNames}` : ""}
Theme: ${theme || "(none specified)"}
Tone: ${tone}
Story style: ${style}
Episode number: ${episodeNumber}

Generate 8 scenes that tell a cohesive micro-story in this tone and style. Every spoken line after "Name: " must be 25-35 words, spoken naturally, and should fill roughly 5 seconds when read aloud (count words carefully).`;

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
          temperature: 0.8,
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
      return NextResponse.json(
        { error: "No AI response" },
        { status: 502 }
      );
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

    const rawScenes = Array.isArray((parsed as { scenes?: unknown })?.scenes)
      ? (parsed as { scenes: unknown[] }).scenes
      : [];
    const scenes: AiStoryScene[] = rawScenes.slice(0, 8).map((s: unknown, i: number) => {
      const row = s as Record<string, unknown>;
      const rawIp =
        typeof row.imagePrompt === "string"
          ? String(row.imagePrompt).trim()
          : "";
      return {
        sceneNumber:
          typeof row.sceneNumber === "number" && row.sceneNumber >= 1
            ? row.sceneNumber
            : i + 1,
        dialogue:
          typeof row.dialogue === "string" ? String(row.dialogue).trim() : "",
        imagePrompt: sanitizeAiStorySceneImagePrompt(rawIp),
        motionPrompt:
          typeof row.motionPrompt === "string"
            ? String(row.motionPrompt).trim()
            : "",
      };
    });
    const rawPack = (parsed as { socialMediaPack?: unknown })?.socialMediaPack as Record<string, unknown> | undefined;
    const hashtags = Array.isArray(rawPack?.hashtags)
      ? rawPack.hashtags
          .map((h) => (typeof h === "string" ? h.trim() : ""))
          .filter((h) => h.length > 0)
          .slice(0, 20)
      : [];
    const socialMediaPack: AiStorySocialMediaPack = {
      caption:
        typeof rawPack?.caption === "string" && rawPack.caption.trim().length > 0
          ? rawPack.caption.trim()
          : "This AI soap drama just exploded in one episode. 🍿🔥",
      title:
        typeof rawPack?.title === "string" && rawPack.title.trim().length > 0
          ? rawPack.title.trim()
          : `Episode ${episodeNumber}: AI Story Drama`,
      hashtags:
        hashtags.length >= 15
          ? hashtags
          : [
              "#AIStory",
              "#FruitDrama",
              "#Brainrot",
              "#AIGenerated",
              "#TikTokStory",
              "#InstagramReels",
              "#DramaSeries",
              "#EpisodeDrop",
              "#ShortFormVideo",
              "#ViralContent",
              "#StoryTime",
              "#AIContent",
              "#ContentCreator",
              "#ReelsIdeas",
              "#FYP",
            ],
      youtubeDescription:
        typeof rawPack?.youtubeDescription === "string" && rawPack.youtubeDescription.trim().length > 0
          ? rawPack.youtubeDescription.trim()
          : `Episode ${episodeNumber} delivers escalating tension, emotional confrontation, and a final cliffhanger. The characters spiral through trust issues, secrets, and shifting alliances scene by scene. Watch until the final moment and follow for the next episode.`,
    };

    const characterTypes = parseCharacterTypes(characters);

    const scenesWithLocks =
      consistencyMode !== "img2img" &&
      characterStyleRegistry &&
      Object.keys(characterStyleRegistry).length > 0 &&
      characterTypes.length > 0
        ? scenes.map((s) => ({
            ...s,
            imagePrompt: mergeCharacterLocksIntoImagePrompt(
              s.imagePrompt,
              characterStyleRegistry,
              characterTypes,
              AI_STORY_GLOBAL_VISUAL_STYLE
            ),
          }))
        : scenes;

    return NextResponse.json({
      scenes: scenesWithLocks,
      socialMediaPack,
      characterStyle: AI_STORY_GLOBAL_VISUAL_STYLE,
      ...(consistencyMode !== "img2img" && characterStyleRegistry
        ? { characterStyleRegistry }
        : {}),
      consistencyMode,
    });
  } catch (e) {
    console.error("[content-studio/ai-story/generate]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
