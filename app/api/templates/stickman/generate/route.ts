import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type StickmanPose =
  | "standing"
  | "thinking"
  | "sitting"
  | "celebrating"
  | "pointing"
  | "defeated"
  | "arms-raised"
  | "walking";

export interface StickmanScene {
  sceneIndex: number;
  caption: string;
  pose: StickmanPose;
}

const VALID_POSES: StickmanPose[] = [
  "standing",
  "thinking",
  "sitting",
  "celebrating",
  "pointing",
  "defeated",
  "arms-raised",
  "walking",
];

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { topic?: string; sceneCount?: number };
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    const sceneCount = typeof body.sceneCount === "number" ? Math.min(Math.max(body.sceneCount, 3), 10) : 6;

    if (!topic) {
      return NextResponse.json({ error: "topic is required" }, { status: 400 });
    }

    const prompt = `Create a ${sceneCount}-scene whiteboard explainer video script about: "${topic}".

Return ONLY a JSON object with a "scenes" array. Each scene object must have exactly these keys:
- sceneIndex: number (0-based, 0 through ${sceneCount - 1})
- caption: string (15-25 words, clear and conversational, directly explaining the topic)
- pose: exactly one of these string values: "standing" | "thinking" | "sitting" | "celebrating" | "pointing" | "defeated" | "arms-raised" | "walking"

Pose selection guide:
- Scene 0 (hook/intro): "pointing" or "standing"
- Problem/challenge scenes: "thinking" or "defeated"
- Key facts/main points: "pointing" or "standing"
- Reflection/consideration: "sitting" or "thinking"
- Solutions/steps: "walking" or "pointing"
- Breakthroughs/wins: "celebrating" or "arms-raised"
- Final summary/CTA: "arms-raised" or "celebrating"

Return ONLY valid JSON, no markdown, no explanation.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 1200,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    const scenesRaw: unknown[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { scenes?: unknown[] }).scenes)
        ? (parsed as { scenes: unknown[] }).scenes
        : [];

    const scenes: StickmanScene[] = scenesRaw
      .filter((s): s is { sceneIndex: number; caption: string; pose: string } =>
        typeof s === "object" &&
        s !== null &&
        typeof (s as { sceneIndex?: unknown }).sceneIndex === "number" &&
        typeof (s as { caption?: unknown }).caption === "string" &&
        typeof (s as { pose?: unknown }).pose === "string"
      )
      .map((s, i) => ({
        sceneIndex: i,
        caption: s.caption.trim(),
        pose: VALID_POSES.includes(s.pose as StickmanPose) ? (s.pose as StickmanPose) : "standing",
      }));

    if (scenes.length === 0) {
      return NextResponse.json({ error: "No scenes generated" }, { status: 500 });
    }

    return NextResponse.json({ scenes });
  } catch (err) {
    console.error("[stickman/generate]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
