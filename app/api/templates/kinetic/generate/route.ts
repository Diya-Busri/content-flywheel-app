import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";

export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * POST /api/templates/kinetic/generate
 * Body: { topic: string, sceneCount?: number, colorScheme?: string }
 * Returns: { topic, colorScheme, scenes: [{ text, accentWords }] }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const body = (await request.json().catch(() => ({}))) as {
      topic?: string;
      sceneCount?: number;
      colorScheme?: string;
    };

    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    const sceneCount = Math.min(Math.max(Number(body.sceneCount) || 12, 6), 30);
    const colorScheme = ["dark-orange", "dark-blue", "dark-green", "dark-purple"].includes(body.colorScheme ?? "")
      ? body.colorScheme!
      : "dark-orange";

    if (!topic) return NextResponse.json({ error: "topic is required" }, { status: 400 });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a viral faceless video scriptwriter specialising in kinetic typography videos.
Write punchy, impactful sentences designed to appear one at a time on a dark screen with bold white text.
Rules:
- Each scene is ONE sentence or short phrase, max 15 words
- Hook the viewer in the first 2 scenes
- Use a mix of facts, insights, questions, and calls to action
- Make it feel like the viewer is learning something valuable fast
- End with a strong CTA scene
- accentWords is how many words at the START of the text should appear in the accent colour (1-3 typically)`,
        },
        {
          role: "user",
          content: `Write exactly ${sceneCount} kinetic typography scenes for a short-form video about: "${topic}".
Return ONLY valid JSON:
{
  "scenes": [
    { "text": "Short punchy sentence here.", "accentWords": 2 }
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

    return NextResponse.json({ topic, colorScheme, scenes: parsed.scenes });
  } catch (err) {
    console.error("[templates/kinetic/generate]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate" },
      { status: 500 }
    );
  }
}
