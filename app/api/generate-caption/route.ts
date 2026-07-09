import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";

export const dynamic = "force-dynamic";

/**
 * POST: Single Instagram-ready caption from slide context.
 * Body: { niche?: string, slides: [{ heading?, body? }] }
 * Returns { caption: string } — prose only, 150–300 words, no hashtags in body.
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

    const systemPrompt = `You write Instagram carousel captions for creators in the ${niche || "general"} niche.
Write ONE cohesive caption (not per-slide) that ties the whole carousel together: hook, value, personality, and a clear CTA.
Requirements:
- Length: strictly between 150 and 300 words (count carefully).
- Tone: engaging, authentic, platform-native; line breaks allowed.
- Do NOT include hashtags or the # symbol.
- Do NOT use markdown or bullet lists; short paragraphs or single blocks are fine.
Return JSON: {"caption": "<the caption text>"} only.`;

    const userPrompt = `Carousel slide content:\n${slideSummaries.join("\n")}`;

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
        temperature: 0.75,
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

    let parsed: { caption?: string };
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json({ error: "Invalid AI response format" }, { status: 502 });
    }

    const caption = typeof parsed.caption === "string" ? parsed.caption.trim() : "";
    if (!caption) {
      return NextResponse.json({ error: "Empty caption" }, { status: 502 });
    }

    return NextResponse.json({ caption });
  } catch (e) {
    console.error("[generate-caption]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
