import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";

export const dynamic = "force-dynamic";

export type CaptionItem = {
  caption: string;
  hashtags: string;
  alt_text: string;
};

/**
 * POST: Generate Instagram/TikTok captions for each slide.
 * Body: { niche: string, slides: [{ heading?, body? }] }
 * Returns { captions: [{ caption, hashtags, alt_text }] } in same order as slides.
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
      return NextResponse.json(
        { error: "At least one slide is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI is not configured. Add OPENAI_API_KEY." },
        { status: 503 }
      );
    }

    const systemPrompt = `You are a social media copywriter. Generate an Instagram/TikTok caption for each of the given slides for someone in the ${niche || "general"} niche. For each slide return:
- caption: 2-3 engaging sentences with a CTA (call to action).
- hashtags: 15 relevant hashtags as a single string (space-separated, no commas).
- alt_text: 1 sentence describing the image for accessibility/SEO.

Return a JSON object with a key "captions" that is an array of objects, each with "caption", "hashtags", and "alt_text" strings. The array must be in the exact same order as the slides. Output only valid JSON, no markdown, no explanation.`;

    const userPrompt = `Slides:\n${slideSummaries.join("\n")}\n\nGenerate one caption set per slide in the same order.`;

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

    let parsed: { captions?: { caption?: string; hashtags?: string; alt_text?: string }[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: "Invalid AI response format" },
        { status: 502 }
      );
    }

    const raw = Array.isArray(parsed.captions) ? parsed.captions : [];
    const captions: CaptionItem[] = raw.slice(0, slides.length).map((c) => ({
      caption: typeof c.caption === "string" ? c.caption.trim() : "",
      hashtags: typeof c.hashtags === "string" ? c.hashtags.trim() : "",
      alt_text: typeof c.alt_text === "string" ? c.alt_text.trim() : "",
    }));

    return NextResponse.json({ captions });
  } catch (e) {
    console.error("[template-studio/generate-captions]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
