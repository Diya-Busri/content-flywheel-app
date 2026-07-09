/**
 * POST /api/template-studio/suggest-topics
 * Given a channel name / niche, returns 6 topic suggestions each with
 * enough metadata to auto-fill the Story Video setup form in one click.
 * Body: { niche: string }
 * Response: { topics: TopicSuggestion[] }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";

export const dynamic = "force-dynamic";

export type TopicSuggestion = {
  title: string;
  targetAudience: string;
  tone: "motivational" | "educational" | "story";
  characterDescription: string;
};

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;
    const aiRl = checkAiRateLimit(userId);
    if (aiRl) return aiRl;

    const body = await request.json().catch(() => ({}));
    const niche = typeof (body as { niche?: string }).niche === "string"
      ? (body as { niche: string }).niche.trim()
      : "";

    if (!niche) {
      return NextResponse.json({ error: "niche is required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 503 });
    }

    const prompt = `You are a YouTube content strategist. For the channel niche "${niche}", suggest exactly 6 high-performing video topics.

For each topic return:
- title: a clear, clickable YouTube title under 65 chars
- targetAudience: 1 short phrase describing the ideal viewer (e.g. "Aspiring entrepreneurs aged 20–35")
- tone: exactly one of "motivational", "educational", or "story" — whichever fits best
- characterDescription: 1 short sentence describing the narrator/presenter style (e.g. "A calm, authoritative voice with personal experience")

Return ONLY a valid JSON array, no markdown, no code fences:
[{"title":"...","targetAudience":"...","tone":"motivational","characterDescription":"..."},...]`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Return only a valid JSON array. No markdown, no explanation." },
          { role: "user", content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 1200,
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "AI request failed" }, { status: 502 });
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    let raw = data.choices?.[0]?.message?.content?.trim() ?? "";

    // Strip any accidental markdown fences
    raw = raw.replace(/^```json\n?/, "").replace(/^```\n?/, "").replace(/\n?```$/, "").trim();

    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) {
      return NextResponse.json({ error: "Could not parse suggestions" }, { status: 500 });
    }

    const parsed = JSON.parse(match[0]) as Array<{
      title?: string;
      targetAudience?: string;
      tone?: string;
      characterDescription?: string;
    }>;

    const VALID_TONES = ["motivational", "educational", "story"] as const;
    const topics: TopicSuggestion[] = parsed.slice(0, 6).map((item) => ({
      title: typeof item.title === "string" ? item.title.trim() : "Untitled",
      targetAudience: typeof item.targetAudience === "string" ? item.targetAudience.trim() : "",
      tone: VALID_TONES.includes(item.tone as (typeof VALID_TONES)[number])
        ? (item.tone as TopicSuggestion["tone"])
        : "educational",
      characterDescription: typeof item.characterDescription === "string" ? item.characterDescription.trim() : "",
    }));

    return NextResponse.json({ topics });
  } catch (err) {
    console.error("[template-studio/suggest-topics]", err);
    return NextResponse.json({ error: "Failed to generate suggestions" }, { status: 500 });
  }
}
