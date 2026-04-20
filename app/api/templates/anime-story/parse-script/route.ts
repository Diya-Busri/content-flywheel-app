import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function splitIntoSegments(rawScript: string): string[] {
  const byParagraph = rawScript
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);
  if (byParagraph.length >= 3) return byParagraph;

  return rawScript
    .split(/\n/)
    .map((s) => s.replace(/^\d+[\.\)]\s*/, "").trim())
    .filter((s) => s.length > 10);
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const body = (await request.json().catch(() => ({}))) as {
      rawScript?: string;
      character?: string;
      tone?: string;
    };

    const rawScript = typeof body.rawScript === "string" ? body.rawScript.trim() : "";
    if (!rawScript) return NextResponse.json({ error: "rawScript is required" }, { status: 400 });

    const character = typeof body.character === "string" ? body.character.trim() : "young protagonist";
    const tone = typeof body.tone === "string" ? body.tone.trim() : "emotional";
    const segments = splitIntoSegments(rawScript);

    if (segments.length === 0) {
      return NextResponse.json({ error: "Could not split script into scenes. Try separating each scene with a blank line." }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You add visual descriptions and subtitles to existing voiceover lines for an anime story video. You do NOT rewrite the voiceover — only add a visualDescription (anime scene for image generation) and a subtitleText (4-7 punchy words). Character: ${character}. Tone: ${tone}.`,
        },
        {
          role: "user",
          content: `For each voiceover line below, add a visualDescription (anime-style scene that matches the moment) and a subtitleText (4-7 punchy words). Do not change the voiceover text.

Return ONLY valid JSON:
{
  "scenes": [
    {
      "sceneNumber": 1,
      "voiceoverLine": "EXACT voiceover from below, unchanged",
      "visualDescription": "Anime scene description for image generation",
      "subtitleText": "4-7 word subtitle"
    }
  ]
}

Voiceover lines:
${segments.map((s, i) => `${i + 1}. ${s}`).join("\n")}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { scenes?: unknown[] };

    if (!Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
      return NextResponse.json({ error: "AI returned no scenes" }, { status: 500 });
    }

    return NextResponse.json({ scenes: parsed.scenes });
  } catch (err) {
    console.error("[templates/anime-story/parse-script]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to parse script" },
      { status: 500 }
    );
  }
}
