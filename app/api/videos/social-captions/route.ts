import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { getBrandVoice } from "@/lib/brand-voice";

export const dynamic = "force-dynamic";

/**
 * POST /api/videos/social-captions
 * Generate social captions from video title + script text (no product required).
 * Body: { title: string, script: string }
 * Returns: { tiktok_title, tiktok, instagram_title, instagram, youtube_title, twitter }
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;
    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 503 });

    const body = await request.json().catch(() => ({})) as { title?: string; script?: string };
    const title = (body.title ?? "").trim() || "Video";
    const script = (body.script ?? "").trim();

    const brandVoice = await getBrandVoice(userId).catch(() => "");

    const userPrompt = `Create social media captions AND titles for a short-form video.

VIDEO TITLE: "${title}"
${script ? `VIDEO SCRIPT:\n${script}` : ""}

Return ONLY valid JSON (no markdown, no code fences) in this exact shape:
{
  "tiktok_title": "...",
  "tiktok": "...",
  "instagram_title": "...",
  "instagram": "...",
  "youtube_title": "...",
  "twitter": "..."
}

Rules:
- tiktok_title: Short punchy video title, max 8 words, no hashtags
- TikTok caption: Hook in first line, conversational, trending language, 3-5 relevant hashtags at the end, max 150 words
- instagram_title: Benefit-driven title, max 10 words, no hashtags
- Instagram caption: Story-driven, benefit-focused, 5-8 hashtags at the end, max 200 words
- youtube_title: SEO-optimised title with keyword near the front, max 60 characters, no hashtags
- Twitter/X: Punchy, 1 bold claim, max 240 characters total including any hashtags`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: [
              "You are a social media copywriter. You write scroll-stopping captions that drive engagement. Return only valid JSON.",
              brandVoice ? `\n${brandVoice}` : "",
            ].join(""),
          },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.75,
        max_tokens: 800,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[videos/social-captions] OpenAI error:", response.status, errText);
      return NextResponse.json({ error: "Failed to generate captions" }, { status: 502 });
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = (data.choices?.[0]?.message?.content ?? "").trim();

    let parsed: { tiktok?: string; instagram?: string; twitter?: string; tiktok_title?: string; instagram_title?: string; youtube_title?: string } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Invalid response from AI" }, { status: 502 });
    }

    return NextResponse.json({
      tiktok_title: parsed.tiktok_title ?? "",
      tiktok: parsed.tiktok ?? "",
      instagram_title: parsed.instagram_title ?? "",
      instagram: parsed.instagram ?? "",
      youtube_title: parsed.youtube_title ?? "",
      twitter: parsed.twitter ?? "",
    });
  } catch (err) {
    console.error("[videos/social-captions]", err);
    return NextResponse.json({ error: "Failed to generate captions" }, { status: 500 });
  }
}
