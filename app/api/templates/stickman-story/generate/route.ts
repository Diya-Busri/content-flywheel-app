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
          content:
            "You write whiteboard stickman story scripts. Each scene has a visual description (what stickman characters are doing, for image generation), a narration (voiceover, 1-3 sentences), and a caption (3-6 bold words summarising the scene).",
        },
        {
          role: "user",
          content: `Write exactly ${sceneCount} scenes for this whiteboard stickman story.

Premise: ${premise}
Narration tone: ${narrationTone}

Return ONLY valid JSON in this exact format:
{
  "scenes": [
    {
      "sceneNumber": 1,
      "visualDescription": "What stickman characters are doing in this scene, for image generation",
      "narration": "1-3 sentence voiceover narration for this scene.",
      "captionText": "3-6 BOLD WORDS"
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
