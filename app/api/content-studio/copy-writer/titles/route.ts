import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";

export const dynamic = "force-dynamic";

export type TitleStyle = "curiosity" | "direct" | "clickbait";

export type TitleOption = {
  style: TitleStyle;
  title: string;
  characterCount: number;
};

const PLATFORM_LIMITS: Record<string, number> = {
  youtube: 100,
  tiktok: 150,
  instagram: 125,
};

const STYLE_LABELS: Record<TitleStyle, string> = {
  curiosity: "Curiosity",
  direct: "Direct",
  clickbait: "Clickbait",
};

/**
 * POST: Generate 3 title variations (curiosity, direct, clickbait) for a video topic.
 * Body: { topic: string, platform?: "youtube" | "tiktok" | "instagram" }
 * Returns titles optimized for CTR, within platform character limit.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const apiRl = await checkApiRateLimit(userId);

    if (apiRl) return apiRl;

    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    if (!topic) {
      return NextResponse.json(
        { error: "topic is required" },
        { status: 400 }
      );
    }

    const platform = ["youtube", "tiktok", "instagram"].includes(body.platform)
      ? body.platform
      : "youtube";
    const maxChars = PLATFORM_LIMITS[platform] ?? 100;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey)
      return NextResponse.json(
        { error: "AI is not configured. Add OPENAI_API_KEY." },
        { status: 503 }
      );

    const systemPrompt = `You are an expert copywriter for video titles. Generate exactly 3 title options for the given video topic, each optimized for click-through rate (CTR). Output valid JSON only, no markdown, no explanation.

Required JSON shape:
{
  "titles": [
    { "style": "curiosity", "title": "..." },
    { "style": "direct", "title": "..." },
    { "style": "clickbait", "title": "..." }
  ]
}

Styles:
- curiosity: Hook with mystery or intrigue (e.g. "This Secret Trick Changed Everything...")
- direct: Clear, SEO-friendly, benefit-focused (e.g. "How to Grow Your YouTube Channel in 2026")
- clickbait: Bold claim or transformation (e.g. "I Tried This for 30 Days... You Won't Believe What Happened")

Every title MUST be at most ${maxChars} characters for ${platform}. Count carefully.`;

    const userPrompt = `Video topic: ${topic}\n\nGenerate 3 titles (curiosity, direct, clickbait), each under ${maxChars} characters.`;

    const response = await fetchOpenAIWithRetry(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json(
        { error: "AI request failed", details: err },
        { status: 502 }
      );
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "No AI response" },
        { status: 502 }
      );
    }

    let parsed: { titles?: { style?: string; title?: string }[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: "Invalid AI response format" },
        { status: 502 }
      );
    }

    const rawTitles = Array.isArray(parsed.titles) ? parsed.titles : [];
    const titles: TitleOption[] = rawTitles
      .slice(0, 3)
      .map((t) => {
        const style = t.style && ["curiosity", "direct", "clickbait"].includes(t.style)
          ? (t.style as TitleStyle)
          : "direct";
        const title = typeof t.title === "string" ? t.title.trim() : "";
        const characterCount = title.length;
        return {
          style,
          title: title.slice(0, maxChars),
          characterCount: Math.min(characterCount, maxChars),
        };
      })
      .filter((t) => t.title);

    // Ensure we have exactly 3 in order
    const order: TitleStyle[] = ["curiosity", "direct", "clickbait"];
    const byStyle = new Map(titles.map((t) => [t.style, t]));
    const result: TitleOption[] = order
      .map((s) => byStyle.get(s))
      .filter(Boolean) as TitleOption[];
    if (result.length < 3) {
      result.push(
        ...titles.filter((t) => !order.includes(t.style))
      );
    }

    return NextResponse.json({
      titles: result.slice(0, 3),
      platform,
      maxCharacters: maxChars,
      styleLabels: STYLE_LABELS,
    });
  } catch (e) {
    console.error("copy-writer titles:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
