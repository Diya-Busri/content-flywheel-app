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

    const systemPrompt = `You are a YouTube strategist who writes titles and descriptions for founder-led, honest, educational channels. You know what earns clicks vs. what begs for them. You write with a direct, problem-first voice — not like a marketing agency. Always return valid JSON.`;

    const userPrompt = `Generate complete YouTube SEO metadata for a video about: "${subject}"${niche ? ` (niche: ${niche})` : ""}${description ? `\n\nVideo context: ${description.slice(0, 500)}` : ""}

TITLE RULES — follow exactly:
Use ONE of these formulas, adapted to the specific topic:
• "The real reason [common struggle people have with this topic]"
• "Why [common belief about this topic] is [wrong / keeping you stuck]"
• "Most [people/beginners/creators] [fail at X] — here's what's actually happening"
• "I [did the thing] so you don't have to — what I learned"
• "[Number] things nobody tells you about [topic]"

Title requirements:
- Opens a CURIOSITY GAP — makes the viewer feel like they're missing something true
- Feels like a real person said it, not a content formula
- Specific — references the actual topic, not a vague category
- Under 70 characters. No ALL CAPS words.
- BANNED WORDS (kill the title instantly — never use): Unlock, Unlocking, Unveiling, Exploring, Discover, Deep Dive, Introduction to, Understanding, Journey, Comprehensive, Ultimate Guide, Everything You Need, Complete Guide, Supercharge, Transform, Boost, Game-changing

DESCRIPTION RULES:
- First 2 lines (shown before "show more") must name the real problem the video addresses — make the viewer feel seen, not sold to
- Then 3–5 specific bullet points of what they'll actually learn (tied to the exact video topic)
- End with: subscribe reason (why this channel, specifically) + what's coming next
- No filler: never use "In this video we explore...", "Join us as we...", "Today we'll be discussing..."
- 600–900 characters total

Return ONLY a valid JSON object:
{
  "title": "Direct, honest title using one of the formulas — specific, curiosity-gap, under 70 chars",
  "description": "SEO description following the rules above — problem-first, no filler",
  "keywords": ["10-15 specific keyword phrases directly related to the topic — no generic filler"],
  "thumbnailPrompt": "DALL-E prompt for a YouTube thumbnail: bold, high contrast, minimal text overlay. Describe the scene, lighting, composition — make it feel honest and direct, not clickbait-y."
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
