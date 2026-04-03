import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { normalizeRawQuizRound, shuffleQuizRound } from "@/lib/viral-quiz-shuffle";
import { pickRandomViralVisualThemeId } from "@/lib/viral-visual-themes";

export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * POST /api/templates/viral/generate
 * Body: { type: "would-you-rather" | "quiz", topic: string, roundCount?: number }
 * Returns: { type, topic, rounds: [...] }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const body = (await request.json().catch(() => ({}))) as {
      type?: string;
      topic?: string;
      roundCount?: number;
    };

    const type = body.type === "quiz" ? "quiz" : "would-you-rather";
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    const roundCount = Math.min(Math.max(Number(body.roundCount) || 7, 3), 15);

    if (!topic) return NextResponse.json({ error: "topic is required" }, { status: 400 });

    const systemPrompt =
      type === "would-you-rather"
        ? `You are a viral TikTok content creator specialising in "Would You Rather" videos. Generate engaging, thought-provoking dilemmas that get people commenting. Make them specific, interesting, and related to the topic. Avoid boring obvious choices. Keep each option concise (max 12 words).`
        : `You are a viral TikTok quiz creator. Generate engaging trivia questions related to the topic. Each question must have exactly 4 options. Make sure only one is clearly correct. Include a brief explanation (1 sentence) for the correct answer. Keep questions and options concise.`;

    const userPrompt =
      type === "would-you-rather"
        ? `Generate exactly ${roundCount} Would You Rather dilemmas about: "${topic}".
For each option, include a relevant single emoji that represents it visually.
Return ONLY valid JSON in this exact format:
{
  "rounds": [
    { "optionA": "...", "optionB": "...", "emojiA": "🍕", "emojiB": "🍣" }
  ]
}`
        : `Generate exactly ${roundCount} trivia quiz questions about: "${topic}".
Include a relevant single emoji for the question topic.
Put the truly correct answer in options[0] and set correctIndex to 0 (order will be randomized after generation).
Return ONLY valid JSON in this exact format:
{
  "rounds": [
    {
      "question": "...",
      "options": ["correct answer text here", "wrong option", "wrong option", "wrong option"],
      "correctIndex": 0,
      "explanation": "...",
      "emoji": "⚽"
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.85,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { rounds?: unknown[] };

    if (!Array.isArray(parsed.rounds) || parsed.rounds.length === 0) {
      return NextResponse.json({ error: "AI returned no rounds" }, { status: 500 });
    }

    const rounds =
      type === "quiz"
        ? parsed.rounds.map((r) => shuffleQuizRound(normalizeRawQuizRound(r)))
        : parsed.rounds;

    const visualTheme = pickRandomViralVisualThemeId();
    return NextResponse.json({ type, topic, rounds, visualTheme });
  } catch (err) {
    console.error("[templates/viral/generate]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate" },
      { status: 500 }
    );
  }
}
