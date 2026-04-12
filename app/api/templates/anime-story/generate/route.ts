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
          content: `You write short-form POV anime story scripts for TikTok/Reels. You are a storyteller first — every scene must connect to the last and build toward a payoff. Follow a clear arc: setup → struggle → turning point → resolution. The viewer should feel like they are watching one coherent story, not a random series of images.

Rules:
- Scene 1: establish WHO the character is and their world right now
- Middle scenes: show the specific struggle, the doubt, the small moments that matter
- Final scene: the payoff — what changed, what they became
- Each voiceover line must follow naturally from the previous one — read them in order and they should sound like one flowing narration
- Subtitles are 4-7 words, punchy, tied directly to that scene's moment (not generic)
- Never write vague lines like "she kept going" or "the journey began" — be SPECIFIC to the premise
- Visual descriptions must match the voiceover — same setting, same moment, same emotion`,
        },
        {
          role: "user",
          content: `Write exactly ${sceneCount} scenes for this anime story. Every scene must connect — this is ONE story told in ${sceneCount} moments, not ${sceneCount} random scenes.

Premise: ${premise}
Tone: ${tone}
Main character: ${character}

Story arc to follow:
- Scenes 1-2: Who is this person right now? What is their life like?
- Scenes 3-${Math.round(sceneCount * 0.6)}: The struggle — specific hard moments tied directly to the premise
- Scenes ${Math.round(sceneCount * 0.6) + 1}-${sceneCount - 1}: The shift — something changes inside them
- Scene ${sceneCount}: The payoff — where they end up

Return ONLY valid JSON:
{
  "scenes": [
    {
      "sceneNumber": 1,
      "visualDescription": "Specific visual for image generation — must match the voiceover moment exactly",
      "subtitleText": "4-7 words tied to this specific moment",
      "voiceoverLine": "1-2 sentences that connect to scene before and after."
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
