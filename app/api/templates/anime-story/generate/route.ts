import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const body = (await request.json().catch(() => ({}))) as {
      premise?: string;
      tone?: string;
      character?: string;
      format?: "short" | "long";
      sceneCount?: number;
    };

    const premise = typeof body.premise === "string" ? body.premise.trim() : "";
    if (!premise) return NextResponse.json({ error: "premise is required" }, { status: 400 });

    const tone = typeof body.tone === "string" ? body.tone.trim() : "emotional";
    const character = typeof body.character === "string" ? body.character.trim() : "a determined young protagonist";
    const format = body.format === "long" ? "long" : "short";

    const defaultCount = format === "long" ? 20 : 8;
    const sceneCount =
      typeof body.sceneCount === "number"
        ? Math.min(Math.max(Math.round(body.sceneCount), 6), 40)
        : defaultCount;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You write short-form POV anime story scripts for TikTok/Reels. Each scene needs a visual description for image generation, a subtitle (4-8 words, punchy), and a voiceover line (1-2 short sentences for narration). Stories are cinematic, emotional, character-driven.",
        },
        {
          role: "user",
          content: `Write exactly ${sceneCount} scenes for the following anime story.

Premise: ${premise}
Tone: ${tone}
Main character: ${character}

Return ONLY valid JSON in this exact format:
{
  "scenes": [
    {
      "sceneNumber": 1,
      "visualDescription": "Detailed visual description for image generation",
      "subtitleText": "4-8 word punchy subtitle",
      "voiceoverLine": "1-2 short narration sentences."
    }
  ]
}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { scenes?: unknown[] };

    if (!Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
      return NextResponse.json({ error: "AI returned no scenes" }, { status: 500 });
    }

    return NextResponse.json({ scenes: parsed.scenes });
  } catch (err) {
    console.error("[templates/anime-story/generate]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate scenes" },
      { status: 500 }
    );
  }
}
