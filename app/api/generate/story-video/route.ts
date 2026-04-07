import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";
import { sanitizeAiStorySceneImagePrompt } from "@/lib/ai-story-character-style";
import { prependCharacterSeedToSceneImagePrompts } from "@/lib/story-character-seed";
import {
  STORY_VIDEO_FIXED_CHARACTER_SEED,
  STORY_VIDEO_VISUAL_CHARACTER_FRAMING_RULE,
  clampStoryVideoSceneCount,
  parseStoryVideoFormatFromBody,
  parseStoryVideoStructureFromBody,
  type StoryVideoFormat,
  type StoryVideoVideoStructure,
} from "@/lib/story-video";

export const dynamic = "force-dynamic";

export type StoryVideoScene = {
  sceneNumber: number;
  dialogue: string;
  imagePrompt: string;
  motionPrompt: string;
};

const TONES = ["motivational", "educational", "story"] as const;

function normalizeScenesFromParsed(parsed: unknown, maxScenes: number): StoryVideoScene[] {
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
  return raw.slice(0, maxScenes).map((s: unknown, i: number) => {
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

function toneGuidance(tone: (typeof TONES)[number]): string {
  switch (tone) {
    case "motivational":
      return `TONE: Motivational — high-energy, encouraging, clear stakes and payoff. Speak directly to the viewer; end scenes on momentum toward action or belief.`;
    case "educational":
      return `TONE: Educational — teach one idea per scene when possible; simple language; concrete examples; no jargon walls.`;
    case "story":
      return `TONE: Story — narrative arc (setup → tension → turn → resolution or hook). If a character is described, keep them consistent; otherwise use a single implied protagonist or narrator voice.`;
  }
}

function longFormStructureBlock(
  sceneCount: number,
  structure: StoryVideoVideoStructure
): string {
  const structureLean =
    structure === "educational"
      ? "Educational lean: prioritize clarity, frameworks, and teachable beats in the journey and lessons."
      : structure === "motivational"
        ? "Motivational lean: emphasize transformation, belief shifts, and energizing language in the journey and CTA."
        : "Full story lean: strong character or through-line, emotional beats, and a satisfying payoff before lessons.";

  return `YOUTUBE LONG-FORM STRUCTURE — follow this arc across all ${sceneCount} scenes (split scene counts proportionally; the Story/Journey block uses the majority of scenes between problem setup and key lessons):

1) HOOK — exactly 1 scene: pattern interrupt; clear promise of payoff.
2) PROBLEM SETUP — 2–3 scenes: context, stakes, relatable tension or question.
3) STORY / JOURNEY — bulk of scenes (everything after problem setup until key lessons): narrative development, examples, turning points, proof, or progression.
4) KEY LESSONS — 3–4 scenes: crisp takeaways the viewer can remember.
5) CTA — exactly 1 scene: subscribe, watch next, comment, or one concrete next step.

${structureLean}

image_prompt: wide horizontal framing suitable for 16:9 landscape (environment readable left-to-right); avoid portrait-only or tall-vertical framing cues. One cinematic still per scene; no text in frame.
${STORY_VIDEO_VISUAL_CHARACTER_FRAMING_RULE}`;
}

function buildStoryVideoSystemPrompt(params: {
  format: StoryVideoFormat;
  sceneCount: number;
  tone: (typeof TONES)[number];
  videoStructure: StoryVideoVideoStructure;
}): string {
  const { format, sceneCount, tone, videoStructure } = params;
  const toneBlock = toneGuidance(tone);

  if (format === "long") {
    return `You are a writer for long-form horizontal YouTube videos (16:9).

Generate exactly ${sceneCount} scenes as JSON with top-level key "scenes" (array of ${sceneCount} objects).

Each scene object must include:
- scene_number (number, 1–${sceneCount})
- dialogue (string) OR voiceover (string): primary spoken script for ~5 seconds when read aloud (about 25–35 words). Use "Narrator: ..." if there is no named character; if the user gave a character, use "Name: ..." format.
- image_prompt (string): one wide cinematic still for 16:9; no text or lettering in frame; no panels/grids/multi-frame layouts
- motion_prompt (string): short animation hint (e.g. slow lateral drift, gentle push-in)

${longFormStructureBlock(sceneCount, videoStructure)}

${toneBlock}

Rules:
- Target the specified audience in vocabulary and examples.
- Topic must run through the full arc across all scenes.
- image_prompt describes setting, lighting, action — one cohesive wide frame only.
- ${STORY_VIDEO_VISUAL_CHARACTER_FRAMING_RULE}

Return ONLY valid JSON: { "scenes": [ ... ] }`;
  }

  return `You are a writer for short-form vertical "story" videos (TikTok / Reels / Shorts).

Generate exactly ${sceneCount} scenes as JSON with top-level key "scenes" (array of ${sceneCount} objects).

Each scene object must include:
- scene_number (number, 1–${sceneCount})
- dialogue (string) OR voiceover (string): primary spoken script for ~5 seconds when read aloud (about 25–35 words). Use "Narrator: ..." if there is no named character; if the user gave a character, use "Name: ..." format.
- image_prompt (string): one cinematic still, no text or lettering in frame, no panels/grids/multi-frame layouts
- motion_prompt (string): short animation hint (e.g. slow push-in, handheld drift)

${toneBlock}

Rules:
- Target the specified audience in vocabulary and examples.
- Topic must run through the full arc across all scenes.
- image_prompt describes setting, lighting, action — one cohesive frame only.
- ${STORY_VIDEO_VISUAL_CHARACTER_FRAMING_RULE}

Return ONLY valid JSON: { "scenes": [ ... ] }`;
}

/**
 * POST: Generate Story Video scenes (Template Studio).
 * Body: { topic, target_audience, character_description?, tone, scene_count?, episode_number? }
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
    const format = parseStoryVideoFormatFromBody(body);
    const videoStructure = parseStoryVideoStructureFromBody(body);
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    const targetAudience =
      typeof body.target_audience === "string"
        ? body.target_audience.trim()
        : typeof body.targetAudience === "string"
          ? body.targetAudience.trim()
          : "";
    const characterDescription =
      typeof body.character_description === "string"
        ? body.character_description.trim()
        : typeof body.characterDescription === "string"
          ? body.characterDescription.trim()
          : "";
    const toneRaw = typeof body.tone === "string" ? body.tone.trim().toLowerCase() : "";
    const tone = TONES.includes(toneRaw as (typeof TONES)[number])
      ? (toneRaw as (typeof TONES)[number])
      : "story";
    const rawSceneCount =
      typeof body.scene_count === "number" && Number.isFinite(body.scene_count)
        ? body.scene_count
        : typeof body.sceneCount === "number" && Number.isFinite(body.sceneCount)
          ? body.sceneCount
          : NaN;
    const sceneCount = clampStoryVideoSceneCount(rawSceneCount, format);

    const episodeNumber =
      typeof body.episode_number === "number" && body.episode_number >= 1
        ? Math.floor(body.episode_number)
        : typeof body.episodeNumber === "number" && body.episodeNumber >= 1
          ? Math.floor(body.episodeNumber)
          : 1;

    if (!topic || !targetAudience) {
      return NextResponse.json(
        { error: "topic and target_audience are required" },
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

    const systemPrompt = buildStoryVideoSystemPrompt({
      format,
      sceneCount,
      tone,
      videoStructure,
    });

    const userPrompt = `topic: ${topic}
target_audience: ${targetAudience}
character_description: ${characterDescription || "(none — use narrator or invent one consistent lead if story tone needs it)"}
tone: ${tone}
format: ${format === "long" ? "long_form_youtube" : "short_form_vertical"}
${format === "long" ? `video_structure: ${videoStructure}` : ""}
episode_number: ${episodeNumber}

Generate ${sceneCount} scenes now.`;

    const response = await fetchOpenAIWithRetry(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
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

    let scenes = normalizeScenesFromParsed(parsed, sceneCount);
    // Renumber 1..N if model returned gaps
    scenes = scenes.map((s, i) => ({ ...s, sceneNumber: i + 1 }));

    const character_seed = sanitizeAiStorySceneImagePrompt(STORY_VIDEO_FIXED_CHARACTER_SEED);
    scenes = prependCharacterSeedToSceneImagePrompts(scenes, character_seed);

    const socialMediaPack = {
      caption: `${topic.slice(0, 120)}${topic.length > 120 ? "…" : ""} — made for ${targetAudience.slice(0, 40)}${targetAudience.length > 40 ? "…" : ""}. 🎬✨`,
      title: `Episode ${episodeNumber}: ${topic.slice(0, 80)}${topic.length > 80 ? "…" : ""} (${tone})`,
      hashtags: [
        "#StoryVideo",
        "#ShortForm",
        "#Reels",
        "#TikTok",
        "#ContentCreator",
        "#VideoIdeas",
        "#FacelessContent",
        "#AIGenerated",
        "#Storytelling",
        "#VerticalVideo",
        "#Growth",
        "#CreatorTips",
        "#Motivation",
        "#LearnOnTikTok",
        "#FYP",
      ],
      youtubeDescription: `Episode ${episodeNumber}: a ${tone} story-style video on "${topic}" for ${targetAudience}. ${sceneCount} scenes with voiceover-friendly pacing.`,
    };

    return NextResponse.json({
      scenes,
      socialMediaPack,
      characterStyle: "",
      character_seed,
    });
  } catch (e) {
    console.error("[generate/story-video]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
