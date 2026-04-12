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
      format?: "short" | "long" | "epic";
      narrationTone?: string;
      sceneCount?: number;
    };

    const premise = typeof body.premise === "string" ? body.premise.trim() : "";
    if (!premise) return NextResponse.json({ error: "premise is required" }, { status: 400 });

    const format = body.format === "epic" ? "epic" : body.format === "long" ? "long" : "short";
    const narrationTone = typeof body.narrationTone === "string" ? body.narrationTone.trim() : "informative and engaging";

    const defaultCount = format === "epic" ? 60 : format === "long" ? 24 : 10;
    const sceneCount =
      typeof body.sceneCount === "number"
        ? Math.min(Math.max(Math.round(body.sceneCount), 6), 80)
        : defaultCount;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You write whiteboard stickman story scripts. You are a storyteller — every scene must connect to the one before and build toward a clear payoff.

CRITICAL HOOK RULE: Scene 1 MUST be a scroll-stopping hook. Do NOT start with "She was born..." or "It all began..." or any slow setup. Start at the most dramatic or relatable moment of the story — the moment that makes someone stop scrolling and think "wait, what happened?" Examples of good hooks: "She had 48 hours left to save everything." / "Everyone said it was impossible. She was about to prove them wrong." / "This is the story of how she went from $0 to building something real — in her dorm room."

Rules:
- Scene 1: HOOK — most compelling moment or statement, makes viewer stop scrolling immediately
- Scene 2: Brief context — who is this person and why should we care
- Middle scenes: specific struggle and turning points tied directly to the premise
- Final scene: clear payoff — what they have now that they didn't before
- Every narration line flows from the previous — no abrupt topic jumps
- Captions are 3-6 words, punchy, specific (never "THE JOURNEY BEGINS" or "SHE KEPT GOING")
- Visual descriptions must show stickman characters DOING something specific that matches the narration
- Never write filler — every scene must move the story forward`,
        },
        {
          role: "user",
          content: `Write exactly ${sceneCount} scenes for this stickman story. ONE connected story — not ${sceneCount} random scenes.

Premise: ${premise}
Narration tone: ${narrationTone}

Story arc for ${sceneCount} scenes:
- Scene 1: HOOK — the most gripping moment or statement. Do NOT start slow.
- Scene 2: Who is this person and what is their situation?
- Scenes 3-${Math.round(sceneCount * 0.55)}: The real specific struggle tied to this premise
- Scenes ${Math.round(sceneCount * 0.55) + 1}-${sceneCount - 1}: The shift and transformation
- Scene ${sceneCount}: The payoff — where they ended up

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
