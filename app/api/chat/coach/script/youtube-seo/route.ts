export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST: Generate YouTube SEO package from script (and optional topic/niche).
 * Body: { script: string, topic?: string, niche?: string }.
 * Returns: { titles: string[], description: string, tags: string[], thumbnailConcept: string }.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;
    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const body = await req.json().catch(() => ({}));
    const script = typeof (body as { script?: string }).script === "string" ? (body as { script: string }).script.trim() : "";
    const topic = typeof (body as { topic?: string }).topic === "string" ? (body as { topic: string }).topic.trim() : "";
    const niche = typeof (body as { niche?: string }).niche === "string" ? (body as { niche: string }).niche.trim() : "";

    if (!script) return NextResponse.json({ error: "script is required" }, { status: 400 });

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 503 });

    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a YouTube strategist for founder-led, honest, educational channels. Given a video script (and optional topic/niche), output a complete SEO package as valid JSON only (no markdown).

Output format:
{
  "titles": ["Title option 1 (under 60 chars)", "Title option 2", "Title option 3"],
  "description": "Full YouTube description, up to 5000 characters.",
  "tags": ["tag1", "tag2", ...],
  "thumbnailConcept": "1-2 sentences describing a thumbnail idea."
}

TITLE RULES:
- Exactly 3 variations, each under 60 characters
- Write titles that feel like a real person said them — direct, problem-first, honest
- Use formats like: "The real reason [struggle]", "Why [common belief] is [wrong]", "Most [people] [fail at X] — here's why", "I [did the thing] — what happened"
- BANNED words (never use in titles): Unlock, Unlocking, Unveiling, Exploring, Discover, Deep Dive, Introduction to, Understanding, Journey, Comprehensive, Ultimate Guide, Complete Guide, Supercharge, Transform, Boost, Game-changing, Everything You Need
- No ALL CAPS words

DESCRIPTION RULES:
- First 2 lines (shown before "show more"): name the real problem this video addresses — make the viewer feel understood, not marketed to
- Then 3–5 specific bullet points of what they'll actually learn, tied to the exact script content
- Include chapter timestamps (0:00 format) if the script has clear sections
- End with: subscribe reason (specific to the channel's content), what's coming next
- Never use: "In this video we explore...", "Join us as we...", "Today we'll be discussing..."
- Min ~400 chars, can go to 5000

TAG RULES:
- Exactly 30 relevant tags, mix of broad and long-tail
- Include specific phrases a beginner would search, not just category labels

THUMBNAIL CONCEPT RULES:
- Clean, honest, high contrast — not clickbait
- Describe: main visual or metaphor, mood/lighting, text overlay (3–6 words, direct, no exclamation marks), color palette
- Avoid: fake shocked faces, neon arrows, cluttered layouts`,
        },
        {
          role: "user",
          content: [topic && `Topic: ${topic}`, niche && `Niche: ${niche}`, `Script:\n\n${script.slice(0, 15000)}`].filter(Boolean).join("\n\n"),
        },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return NextResponse.json({ error: "No response from model" }, { status: 500 });

    let parsed: { titles?: string[]; description?: string; tags?: string[]; thumbnailConcept?: string };
    try {
      parsed = JSON.parse(raw) as typeof parsed;
    } catch {
      return NextResponse.json({ error: "Invalid model response" }, { status: 500 });
    }

    const titles = Array.isArray(parsed.titles) ? parsed.titles.slice(0, 3).filter((t) => typeof t === "string") : [];
    const description = typeof parsed.description === "string" ? parsed.description.trim() : "";
    const tags = Array.isArray(parsed.tags) ? parsed.tags.filter((t) => typeof t === "string").slice(0, 30) : [];
    const thumbnailConcept = typeof parsed.thumbnailConcept === "string" ? parsed.thumbnailConcept.trim() : "";

    return NextResponse.json({
      titles: titles.length ? titles : ["Untitled Video"],
      description: description || "No description generated.",
      tags,
      thumbnailConcept: thumbnailConcept || "No thumbnail concept generated.",
    });
  } catch (err) {
    console.error("[chat/coach/script/youtube-seo]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "SEO generation failed" }, { status: 500 });
  }
}
