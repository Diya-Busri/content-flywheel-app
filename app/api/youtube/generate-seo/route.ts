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

    const systemPrompt = `You are an elite YouTube SEO strategist who writes titles that get millions of clicks. You know exactly which words kill CTR and which formulas print views. Always return valid JSON.`;

    const userPrompt = `Generate complete YouTube SEO metadata for a video about: "${subject}"${niche ? ` (niche: ${niche})` : ""}${description ? `\n\nVideo context: ${description.slice(0, 500)}` : ""}

TITLE RULES — follow exactly:
Use ONE of these proven high-CTR formulas:
• "The [Shocking Truth / Real Reason / Hidden Secret] About [Topic] Nobody Tells You"
• "Why [Common Belief About Topic] Is [Wrong / A Lie / Keeping You Broke]"
• "How [Specific Person or Group] [Achieved Outcome] Doing This One Thing"
• "[Number] [Things / Signs / Reasons] [Topic] [Strong Outcome] (Most People Don't Know This)"
• "What Happens When [Scenario] — The Truth About [Topic]"

Title requirements:
- Creates a CURIOSITY GAP — teases the answer without giving it away
- Feels PERSONAL — uses "You" or makes the viewer the subject
- Is SPECIFIC — uses numbers, years, or real names where possible
- Under 70 characters. No ALL CAPS words.
- BANNED WORDS (instant CTR killer — do NOT use any of these): Unlock, Unlocking, Unveiling, Exploring, Discover, Deep Dive, Introduction to, Understanding, Journey, Comprehensive, Ultimate Guide, Everything You Need

DESCRIPTION RULES:
- First 2 lines (shown in search before "show more") MUST tease the biggest revelation — make people click
- Then 3-5 bullet points of specific things they'll learn (not generic — tie to the actual topic)
- End with a call to action: subscribe + what's coming next
- No filler phrases like "In this video we explore..." or "Join us as we..."
- 600-900 characters total

Return ONLY a valid JSON object:
{
  "title": "High-CTR title using one of the proven formulas — specific, curiosity-gap, personal, under 70 chars",
  "description": "SEO description following the rules above",
  "keywords": ["10-15 specific keyword phrases directly related to the topic — no generic filler"],
  "thumbnailPrompt": "DALL-E prompt for a YouTube thumbnail: bold, high contrast, eye-catching. Describe the visual scene, lighting, and composition."
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
