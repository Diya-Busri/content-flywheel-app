import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";

export const dynamic = "force-dynamic";

function normalizeHashtag(s: string): string {
  const t = s.trim().replace(/^#+/, "");
  if (!t) return "";
  return `#${t.replace(/\s+/g, "")}`;
}

/**
 * POST: 20–30 hashtags from slide context.
 * Body: { niche?: string, slides: [{ heading?, body? }] }
 * Returns { hashtags: string[] } each with leading #.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;
    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const niche = typeof body.niche === "string" ? body.niche.trim() : "";
    const slides = Array.isArray(body.slides) ? body.slides : [];
    const slideSummaries = slides
      .slice(0, 50)
      .map(
        (s: { heading?: string; body?: string }, i: number) =>
          `Slide ${i + 1}: ${[s.heading, s.body].filter(Boolean).join(" — ") || "(no content)"}`
      );

    if (slideSummaries.length === 0) {
      return NextResponse.json({ error: "At least one slide is required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI is not configured. Add OPENAI_API_KEY." },
        { status: 503 }
      );
    }

    const systemPrompt = `You suggest Instagram hashtags for a carousel in the ${niche || "general"} niche.
Return between 20 and 30 distinct, relevant hashtags (mix of niche-specific and broader reach).
Return JSON only: {"hashtags": ["#tag1", "#tag2", ...]} — each string must start with #, no spaces inside tags, no duplicates.`;

    const userPrompt = `Slide content:\n${slideSummaries.join("\n")}`;

    const response = await fetchOpenAIWithRetry("https://api.openai.com/v1/chat/completions", {
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
        temperature: 0.65,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: "AI request failed", details: err }, { status: 502 });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: "No AI response" }, { status: 502 });
    }

    let parsed: { hashtags?: unknown };
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json({ error: "Invalid AI response format" }, { status: 502 });
    }

    const raw = Array.isArray(parsed.hashtags) ? parsed.hashtags : [];
    const hashtags = Array.from(
      new Set(
        raw
          .filter((h): h is string => typeof h === "string")
          .map(normalizeHashtag)
          .filter(Boolean)
      )
    ).slice(0, 30);

    return NextResponse.json({ hashtags });
  } catch (e) {
    console.error("[generate-hashtags]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
