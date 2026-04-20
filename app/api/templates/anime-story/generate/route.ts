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
      format?: "short" | "long" | "epic";
      sceneCount?: number;
    };

    const premise = typeof body.premise === "string" ? body.premise.trim() : "";
    if (!premise) return NextResponse.json({ error: "premise is required" }, { status: 400 });

    const tone = typeof body.tone === "string" ? body.tone.trim() : "emotional";
    const character = typeof body.character === "string" ? body.character.trim() : "a determined young protagonist";
    const format = body.format === "epic" ? "epic" : body.format === "long" ? "long" : "short";

    const defaultCount = format === "epic" ? 60 : format === "long" ? 20 : 8;
    const sceneCount =
      typeof body.sceneCount === "number"
        ? Math.min(Math.max(Math.round(body.sceneCount), 6), 80)
        : defaultCount;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You write POV anime story scripts. You are a storyteller — every scene must connect to the last and build toward a payoff.

CRITICAL HOOK RULE: Scene 1 MUST stop the scroll. Do NOT open with "She was born..." or slow setup. Open at the most dramatic or emotionally charged moment of the story. The viewer must feel something in the first 3 seconds. Examples: "She stared at her empty bank account. Two weeks left to make this work." / "Everyone around her was celebrating graduation. She was still in her dorm, building." / "This is the story of the night everything almost fell apart."

Rules:
- Scene 1: HOOK — most gripping moment, makes viewer feel something immediately
- Scene 2: Brief context — who is this person and why should we care
- Middle scenes: specific struggle and turning points directly from the premise — no vague filler
- Final scene: the payoff — what changed, what they became
- Each voiceover line flows naturally from the previous — read all lines in sequence, they must sound like ONE narration
- Subtitles 4-7 words, punchy, specific to the moment (not generic)
- Visual descriptions must match voiceover exactly — same setting, same emotion`,
        },
        {
          role: "user",
          content: `Write exactly ${sceneCount} scenes for this anime story. ONE connected story — not ${sceneCount} random scenes.

Premise: ${premise}
Tone: ${tone}
Main character: ${character}

Story arc for ${sceneCount} scenes:
- Scene 1: HOOK — do not start slow. Open at the most compelling moment.
- Scene 2: Who is this person and what is their situation?
- Scenes 3-${Math.round(sceneCount * 0.55)}: The real specific struggle from this premise
- Scenes ${Math.round(sceneCount * 0.55) + 1}-${sceneCount - 1}: The shift and transformation
- Scene ${sceneCount}: The payoff — where they ended up

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
