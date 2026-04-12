import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkAiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({})) as {
      title?: string;
      topic?: string;
      niche?: string;
      description?: string;
    };

    const { title = "", topic = "", niche = "", description = "" } = body;
    const subject = topic.trim() || title.trim();
    if (!subject) {
      return NextResponse.json({ error: "title or topic is required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI not configured" }, { status: 503 });
    }

    const openai = new OpenAI({ apiKey });

    const systemPrompt = `You are an expert YouTube SEO strategist. Your job is to generate viral, click-worthy YouTube metadata that ranks well and gets clicks. Always return valid JSON.`;

    const userPrompt = `Generate complete YouTube SEO metadata for a video about: "${subject}"${niche ? ` in the ${niche} niche` : ""}${description ? `\n\nVideo context: ${description.slice(0, 500)}` : ""}

Return ONLY a valid JSON object with these exact keys:
{
  "title": "A click-worthy YouTube title under 70 characters (no quotes around it)",
  "description": "A 800-1200 character YouTube description. Start with a strong hook. Include: what the video covers, 3-5 bullet points of key takeaways, a call to action (like/subscribe/comment), and relevant hashtags at the end. Use line breaks.",
  "keywords": ["array", "of", "10-15", "seo", "keywords", "and", "phrases", "without", "hashtag", "symbols"],
  "thumbnailPrompt": "A DALL-E image generation prompt for a YouTube thumbnail. Eye-catching, bold text overlay area, high contrast, professional. Describe the visual scene."
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: {
      title?: string;
      description?: string;
      keywords?: unknown;
      thumbnailPrompt?: string;
    };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    const keywords = Array.isArray(parsed.keywords)
      ? parsed.keywords.filter((k): k is string => typeof k === "string").slice(0, 15)
      : [];

    return NextResponse.json({
      title: typeof parsed.title === "string" ? parsed.title.slice(0, 100) : subject,
      description: typeof parsed.description === "string" ? parsed.description.slice(0, 5000) : "",
      keywords,
      thumbnailPrompt: typeof parsed.thumbnailPrompt === "string" ? parsed.thumbnailPrompt : "",
    });
  } catch (err) {
    console.error("[youtube/generate-seo]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate YouTube SEO" },
      { status: 500 }
    );
  }
}
