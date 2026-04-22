/**
 * POST /api/templates/social-kit
 * Generate titles, descriptions & hashtags for a template studio video.
 * Body: { topic, narration? }
 * Returns: { tiktok, instagram, youtube }
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const body = (await request.json().catch(() => ({}))) as { topic?: string; narration?: string };
    const topic = (body.topic ?? "").trim();
    const narration = (body.narration ?? "").slice(0, 600).trim();

    if (!topic) return NextResponse.json({ error: "topic is required" }, { status: 400 });

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 503 });

    const prompt = `You are an expert social media strategist. Generate a Social Media Kit for a short-form story video.

TOPIC: "${topic}"
${narration ? `STORY SNIPPET: "${narration}"` : ""}

Generate platform-ready content. Return ONLY valid JSON — no markdown, no code fence.

{
  "tiktok": {
    "titles": ["5 catchy TikTok title options with emoji, max 100 chars each"],
    "description": "One 150-250 character description with hook sentence, story tease, and CTA",
    "hashtags": "#tag1 #tag2 ... (25-30 relevant hashtags, mix of high-volume and niche)"
  },
  "instagram": {
    "caption": "200-350 character caption with storytelling hook, 2-3 sentences of value, line breaks for readability, and a CTA",
    "hashtags": "#tag1 #tag2 ... (25-30 Instagram-specific hashtags)"
  },
  "youtube": {
    "titles": ["5 SEO-optimised YouTube Shorts title options"],
    "description": "3-4 sentence description with keywords, what the video is about, who it helps, and a CTA"
  }
}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You generate social media kits. Return ONLY valid JSON. No markdown or code fences." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!res.ok) return NextResponse.json({ error: "Failed to generate kit" }, { status: 502 });

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    let content = (data.choices?.[0]?.message?.content ?? "").trim();
    if (content.startsWith("```")) content = content.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");

    const kit = JSON.parse(content);
    return NextResponse.json({ kit });
  } catch (err) {
    console.error("[templates/social-kit]", err);
    return NextResponse.json({ error: "Failed to generate social kit" }, { status: 500 });
  }
}
