import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function splitIntoSegments(rawScript: string): string[] {
  // Try splitting by double newline (paragraphs) first
  const byParagraph = rawScript
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);
  if (byParagraph.length >= 3) return byParagraph;

  // Fall back to single newlines
  return rawScript
    .split(/\n/)
    .map((s) => s.replace(/^\d+[\.\)]\s*/, "").trim()) // strip leading numbers like "1. "
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
      narrationTone?: string;
    };

    const rawScript = typeof body.rawScript === "string" ? body.rawScript.trim() : "";
    if (!rawScript) return NextResponse.json({ error: "rawScript is required" }, { status: 400 });

    const narrationTone = typeof body.narrationTone === "string" ? body.narrationTone.trim() : "motivational";
    const segments = splitIntoSegments(rawScript);

    if (segments.length === 0) {
      return NextResponse.json({ error: "Could not split script into scenes. Try separating each scene with a blank line." }, { status: 400 });
    }

    // Ask GPT-4o to add visual description and caption for each segment
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You add visual descriptions and captions to existing narration lines for a stickman story video. You do NOT rewrite or change the narration — you only add a visualDescription and captionText for each. Visual descriptions describe what stickman characters are doing in that scene. Captions are 3-6 bold words that summarise the moment.`,
        },
        {
          role: "user",
          content: `For each narration line below, add a visualDescription (what stickman characters are doing in 2D cartoon animation style) and a captionText (3-6 bold words). Tone: ${narrationTone}.

Return ONLY valid JSON with this exact structure:
{
  "scenes": [
    {
      "sceneNumber": 1,
      "narration": "EXACT narration from below, do not change it",
      "visualDescription": "Stickman characters doing something specific",
      "captionText": "3-6 WORDS"
    }
  ]
}

Narration lines:
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
    console.error("[templates/stickman-story/parse-script]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to parse script" },
      { status: 500 }
    );
  }
}
