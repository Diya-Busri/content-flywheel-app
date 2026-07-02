export const dynamic = "force-dynamic";
/**
 * POST /api/seo/generate
 *
 * Generates a full YouTube SEO package in one OpenAI (ChatGPT) call:
 * - 3 title variations (CTR-optimized)
 * - Full description (up to 5000 chars, keyword-rich)
 * - 30 tags
 * - Thumbnail concept (text description)
 *
 * Input: script content, niche, target keywords
 * Output: { titles, description, tags, thumbnailConcept }
 *
 * Requires: OPENAI_API_KEY
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import OpenAI from "openai";

const OPENAI_MODEL = "gpt-4o-mini";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const script = typeof (body as { script?: string }).script === "string" ? (body as { script: string }).script.trim() : "";
    const niche = typeof (body as { niche?: string }).niche === "string" ? (body as { niche: string }).niche.trim() : "";
    const targetKeywords = Array.isArray((body as { targetKeywords?: unknown }).targetKeywords)
      ? (body as { targetKeywords: string[] }).targetKeywords.filter((k): k is string => typeof k === "string").map((k) => k.trim()).filter(Boolean)
      : [];

    if (!script) return NextResponse.json({ error: "script is required" }, { status: 400 });

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured. Add it in .env.local." },
        { status: 503 }
      );
    }

    const openai = new OpenAI({ apiKey });
    const userParts: string[] = [];
    if (niche) userParts.push(`Niche: ${niche}`);
    if (targetKeywords.length) userParts.push(`Target keywords (weave in naturally): ${targetKeywords.join(", ")}`);
    userParts.push(`Script:\n\n${script.slice(0, 30000)}`);
    const userContent = userParts.join("\n\n");

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: `You are a YouTube SEO expert. Given a video script and optional niche and target keywords, output a complete SEO package as a single valid JSON object with no markdown or code fences.

Output exactly this structure (no other keys):
{
  "titles": ["Title 1", "Title 2", "Title 3"],
  "description": "Full description text...",
  "tags": ["tag1", "tag2", ...],
  "thumbnailConcept": "One clear thumbnail idea..."
}

Rules:
- titles: Exactly 3 variations. Each under 60 characters. Optimize for CTR: curiosity, benefit, numbers, or power words. Match the script and niche.
- description: Full YouTube description, keyword-rich. Use the target keywords naturally. Include a hook in the first 2 lines. You may add chapter timestamps (0:00 Intro, etc.) if the script has clear sections. Length: aim for 500–5000 characters (up to 5000 chars allowed). No placeholder text.
- tags: Exactly 30 tags. Mix of broad and long-tail. Include target keywords and niche terms. Lowercase, no duplicates.
- thumbnailConcept: 1–3 sentences describing a thumbnail: subject, mood, suggested text overlay, colors/style. Usable for Canva or thumbnail tools.`,
        },
        { role: "user", content: userContent },
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
    const description = typeof parsed.description === "string" ? parsed.description.trim().slice(0, 5000) : "";
    const tags = Array.isArray(parsed.tags) ? parsed.tags.filter((t) => typeof t === "string").slice(0, 30) : [];
    const thumbnailConcept = typeof parsed.thumbnailConcept === "string" ? parsed.thumbnailConcept.trim() : "";

    return NextResponse.json({
      titles: titles.length ? titles : ["Untitled Video"],
      description: description || "No description generated.",
      tags,
      thumbnailConcept: thumbnailConcept || "No thumbnail concept generated.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[seo/generate]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
