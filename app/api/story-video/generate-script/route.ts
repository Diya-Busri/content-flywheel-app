import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";
import {
  STORY_VIDEO_VISUAL_CHARACTER_FRAMING_RULE,
  clampStoryVideoSceneCount,
  parseStoryVideoFormatFromBody,
  parseStoryVideoStructureFromBody,
  type StoryVideoVideoStructure,
} from "@/lib/story-video";

export const dynamic = "force-dynamic";

/** ~150 words/min spoken = 2.5 words/sec (moderate VO pace). */
const WORDS_PER_SECOND = 2.5;

export type StoryVideoScriptScene = {
  sceneNumber: number;
  narration: string;
  visualDescription: string;
  /** Estimated seconds from narration word count. */
  duration: number;
};

const TONES = ["motivational", "educational", "story"] as const;

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

function durationFromWordCount(wordCount: number): number {
  if (wordCount <= 0) return 0;
  return Math.round((wordCount / WORDS_PER_SECOND) * 10) / 10;
}

/** Long-form YouTube only: estimated seconds = wordCount / 2.5 (average speaking pace). */
function durationSecondsLongFormNarration(wordCount: number): number {
  if (wordCount <= 0) return 0;
  return Math.round((wordCount / 2.5) * 10) / 10;
}

/**
 * Neutralize wording in visualDescription before image APIs (filters / brand safety).
 * Includes fixed phrase swaps (e.g. dimly lit → softly lit, dark room → quiet room, struggling → focused,
 * overwhelmed → thinking deeply, broke → determined, frustrated → thoughtful, desperate → motivated).
 * Longer phrases first; then whole-word swaps.
 */
export function postProcessStoryScriptVisualDescription(visual: string): string {
  let s = visual.trim();
  if (!s) return s;

  // Preserve "stand alone" / standalone before replacing "alone"
  s = s.replace(/\bstand\s*[- ]?alone\b/gi, "standalone");

  const phraseReplacements: [RegExp, string][] = [
    [/\bdimly\s*[- ]?\s*lit\b/gi, "softly lit"],
    [/\bdark\s+room\b/gi, "quiet room"],
    [/\bstruggling\b/gi, "focused"],
    [/\boverwhelmed\b/gi, "thinking deeply"],
    [/\bbroke\b/gi, "determined"],
    [/\bfrustrated\b/gi, "thoughtful"],
    [/\bdesperate\b/gi, "motivated"],
    [/\bempty\s+wallet\b/gi, "simple desk with everyday items"],
    [/\bdark\s+corner\b/gi, "quiet corner"],
    [/\bdark\s+space\b/gi, "open calm space"],
    [/\bdark\s+interior\b/gi, "calm interior"],
    [/\bin\s+the\s+dark\b/gi, "in soft ambient light"],
  ];
  for (const [re, rep] of phraseReplacements) {
    s = s.replace(re, rep);
  }

  // Whole-word "alone" → focused (after standalone guard above)
  s = s.replace(/\balone\b/gi, "focused");

  // Remaining "dark" as a mood/lighting word (avoid breaking "dark blue", "dark wood", etc.)
  s = s.replace(
    /\bdark\b(?!\s*(?:blue|green|brown|grey|gray|red|hair|wood|suit|chocolate|skin|mode|matter|magic|knight|age|web|arts|comedy|humor|jeans|denim))/gi,
    "calm"
  );

  return s.replace(/\s{2,}/g, " ").replace(/\s+([,.;])/g, "$1").trim();
}

/**
 * POST /api/story-video/generate-script
 * Body: { topic, audience, tone?, sceneCount? }
 * Returns: JSON array of scenes (sceneNumber, narration, visualDescription, duration).
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
    const audience =
      typeof body.audience === "string"
        ? body.audience.trim()
        : typeof body.targetAudience === "string"
          ? body.targetAudience.trim()
          : "";
    const toneRaw = typeof body.tone === "string" ? body.tone.trim().toLowerCase() : "";
    const tone = TONES.includes(toneRaw as (typeof TONES)[number])
      ? (toneRaw as (typeof TONES)[number])
      : "story";

    const rawSceneCount =
      typeof body.sceneCount === "number" && Number.isFinite(body.sceneCount)
        ? body.sceneCount
        : typeof body.scene_count === "number" && Number.isFinite(body.scene_count)
          ? body.scene_count
          : NaN;
    const sceneCount = clampStoryVideoSceneCount(rawSceneCount, format);

    if (!topic || !audience) {
      return NextResponse.json(
        { error: "topic and audience are required" },
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

    const toneLine =
      tone === "motivational"
        ? "Motivational: direct, energizing, stakes and payoff; speak to the viewer."
        : tone === "educational"
          ? "Educational: clear, concrete, one main idea per scene where possible."
          : "Story: narrative flow (hook → development → turn/closer); consistent voice.";

    const longStructureBlock = (structure: StoryVideoVideoStructure): string => {
      const lean =
        structure === "educational"
          ? "Educational lean: clarity, frameworks, teachable beats in journey and lessons."
          : structure === "motivational"
            ? "Motivational lean: transformation, belief shifts, energizing journey and CTA."
            : "Full story lean: through-line, emotional beats, satisfying payoff before lessons.";
      return `YOUTUBE LONG-FORM STRUCTURE — follow across all ${sceneCount} scenes (Story/Journey uses the bulk of scenes between problem setup and key lessons):

1) HOOK — exactly 1 scene.
2) PROBLEM SETUP — 2–3 scenes.
3) STORY / JOURNEY — majority of scenes: development, examples, turning points.
4) KEY LESSONS — 3–4 scenes.
5) CTA — exactly 1 scene.

${lean}

visualDescription: wide horizontal framing for 16:9 landscape; readable environment left-to-right; avoid portrait-only framing.
${STORY_VIDEO_VISUAL_CHARACTER_FRAMING_RULE}`;
    };

    const systemPrompt =
      format === "long"
        ? `You write long-form horizontal YouTube video scripts (16:9).

Return a JSON object with a single key "scenes" whose value is an array of exactly ${sceneCount} objects.

Each object must have:
- sceneNumber (number, 1 through ${sceneCount})
- narration (string): spoken script for ONE scene. Target 80–120 words per scene (approximately 30–45 seconds of speech at a natural YouTube pacing).
- visualDescription (string): one wide cinematic frame for 16:9—setting, subject, lighting, mood. No on-screen text or captions in the image.

${longStructureBlock(videoStructure)}

Rules:
- The full sequence should cover the topic for the given audience.
- ${toneLine}
- ${STORY_VIDEO_VISUAL_CHARACTER_FRAMING_RULE}
- No markdown. Output only valid JSON.`
        : `You write short-form vertical video scripts (e.g. TikTok/Reels).

Return a JSON object with a single key "scenes" whose value is an array of exactly ${sceneCount} objects.

Each object must have:
- sceneNumber (number, 1 through ${sceneCount})
- narration (string): spoken script for ONE scene. Must read aloud in 15–20 seconds at a natural pace (aim for roughly 38–50 words; stay within that band).
- visualDescription (string): a single clear image/video frame description for illustrators or image models—setting, subject, lighting, mood. No on-screen text or captions in the image.

Rules:
- The full sequence should cover the topic for the given audience.
- ${toneLine}
- ${STORY_VIDEO_VISUAL_CHARACTER_FRAMING_RULE}
- No markdown. Output only valid JSON.`;

    const userPrompt = `Topic: ${topic}
Target audience: ${audience}
Tone: ${tone}
Format: ${format === "long" ? "long_form_youtube" : "short_form_vertical"}
${format === "long" ? `Video structure: ${videoStructure}` : ""}
Number of scenes: ${sceneCount}`;

    const response = await fetchOpenAIWithRetry("https://api.openai.com/v1/chat/completions", {
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
    });

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

    const rawScenes = Array.isArray((parsed as { scenes?: unknown })?.scenes)
      ? (parsed as { scenes: unknown[] }).scenes
      : [];

    const scenes: StoryVideoScriptScene[] = rawScenes.slice(0, sceneCount).map((row: unknown, i: number) => {
      const r = row as Record<string, unknown>;
      const narration =
        typeof r.narration === "string"
          ? r.narration.trim()
          : typeof r.script === "string"
            ? r.script.trim()
            : "";
      const visualDescription =
        typeof r.visualDescription === "string"
          ? r.visualDescription.trim()
          : typeof r.visual_description === "string"
            ? r.visual_description.trim()
            : "";
      const sn =
        typeof r.sceneNumber === "number" && r.sceneNumber >= 1
          ? Math.floor(r.sceneNumber)
          : typeof r.scene_number === "number" && r.scene_number >= 1
            ? Math.floor(r.scene_number)
            : i + 1;
      const words = countWords(narration);
      return {
        sceneNumber: sn,
        narration,
        visualDescription: postProcessStoryScriptVisualDescription(visualDescription),
        duration:
          format === "long" ? durationSecondsLongFormNarration(words) : durationFromWordCount(words),
      };
    });

    const normalized = scenes.map((s, idx) => ({
      ...s,
      sceneNumber: idx + 1,
    }));

    return NextResponse.json(normalized);
  } catch (e) {
    console.error("[story-video/generate-script]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
