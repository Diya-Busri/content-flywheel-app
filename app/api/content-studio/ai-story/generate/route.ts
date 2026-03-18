import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";

export const dynamic = "force-dynamic";

export type AiStoryScene = {
  sceneNumber: number;
  dialogue: string;
  imagePrompt: string;
  motionPrompt: string;
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

    const systemPrompt = `You are a scriptwriter for short-form AI story episodes. Generate exactly 8 scenes for one episode.

STYLE: ${style}
${characterNamesInstruction ?? styleBlock}

For each scene you must output:
- sceneNumber: 1 through 8
- dialogue: what the characters say in this scene (1-3 sentences), with "CharacterName: " prefix
- imagePrompt: a detailed image description for generating a still image (visual style, setting, mood, no text)
- motionPrompt: a short description for how the scene could animate or move (e.g. "slow zoom on face", "text fades in")

Return a JSON object with a key "scenes" that is an array of exactly 8 objects, each with: sceneNumber (number), dialogue (string), imagePrompt (string), motionPrompt (string). Output only valid JSON, no markdown, no explanation.`;

    const userPrompt = `Character types: ${characters || "(none specified)"}
${characterNames ? `Character names (use exactly): ${characterNames}` : ""}
Theme: ${theme || "(none specified)"}
Tone: ${tone}
Story style: ${style}
Episode number: ${episodeNumber}

Generate 8 scenes that tell a cohesive micro-story in this tone and style.`;

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
    const scenes: AiStoryScene[] = rawScenes
      .slice(0, 8)
      .map((s: Record<string, unknown>, i: number) => ({
        sceneNumber:
          typeof s.sceneNumber === "number" && s.sceneNumber >= 1
            ? s.sceneNumber
            : i + 1,
        dialogue:
          typeof s.dialogue === "string" ? String(s.dialogue).trim() : "",
        imagePrompt:
          typeof s.imagePrompt === "string"
            ? String(s.imagePrompt).trim()
            : "",
        motionPrompt:
          typeof s.motionPrompt === "string"
            ? String(s.motionPrompt).trim()
            : "",
      }));

    return NextResponse.json({ scenes });
  } catch (e) {
    console.error("[content-studio/ai-story/generate]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
