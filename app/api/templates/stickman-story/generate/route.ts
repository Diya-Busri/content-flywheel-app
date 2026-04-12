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
      format?: "short" | "long";
      narrationTone?: string;
      sceneCount?: number;
    };

    const premise = typeof body.premise === "string" ? body.premise.trim() : "";
    if (!premise) return NextResponse.json({ error: "premise is required" }, { status: 400 });

    const format = body.format === "long" ? "long" : "short";
    const narrationTone = typeof body.narrationTone === "string" ? body.narrationTone.trim() : "informative and engaging";

    const defaultCount = format === "long" ? 24 : 10;
    const sceneCount =
      typeof body.sceneCount === "number"
        ? Math.min(Math.max(Math.round(body.sceneCount), 6), 40)
        : defaultCount;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You write whiteboard stickman story scripts for TikTok/Reels. You are a storyteller — every scene must connect to the one before and build toward a clear payoff. Follow a tight arc: setup → conflict → turning point → resolution. Read all the narration lines in order — they must sound like ONE continuous story, not disconnected observations.

Rules:
- Scene 1: establish the character and their situation specifically
- Middle scenes: show the real struggle — concrete, specific moments from the premise
- Final scene: clear resolution — what changed, what they have now
- Every narration line flows from the previous — no abrupt topic jumps
- Captions are 3-6 words, punchy, specific to that moment (never generic like "THE JOURNEY BEGINS")
- Visual descriptions must show stickman characters DOING something specific that matches the narration
- Never write filler scenes — every scene must move the story forward`,
        },
        {
          role: "user",
          content: `Write exactly ${sceneCount} scenes for this stickman story. This is ONE story told in ${sceneCount} connected moments — not ${sceneCount} random scenes.

Premise: ${premise}
Narration tone: ${narrationTone}

Story arc:
- Scenes 1-2: Who is this person? What is their situation right now?
- Scenes 3-${Math.round(sceneCount * 0.6)}: The specific struggle and challenges from this premise
- Scenes ${Math.round(sceneCount * 0.6) + 1}-${sceneCount - 1}: The shift — what changes
- Scene ${sceneCount}: The payoff

Return ONLY valid JSON:
{
  "scenes": [
    {
      "sceneNumber": 1,
      "visualDescription": "Stickman characters doing something specific that matches the narration exactly",
      "narration": "1-2 sentences that connect naturally to the scene before and after.",
      "captionText": "3-6 SPECIFIC WORDS"
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
    console.error("[templates/stickman-story/generate]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate scenes" },
      { status: 500 }
    );
  }
}
