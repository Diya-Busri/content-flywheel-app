/**
 * POST /api/launch/marketing
 * Generates a quick launch marketing kit:
 *   - 3 social media captions (TikTok/Instagram style)
 *   - Email subject line
 *   - Hashtag set
 * Uses GPT-4o-mini for fast generation.
 */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;
    const aiRl = checkAiRateLimit(userId);
    if (aiRl) return aiRl;

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const insights: string[]   = Array.isArray(body.insights) ? body.insights.map(String) : [];
    const query: string        = typeof body.query === "string" ? body.query.trim() : "";
    const productName: string  = typeof body.productName === "string" ? body.productName.trim() : query;
    const priceRange: string   = typeof body.priceRange === "string" ? body.priceRange.trim() : "";

    const aiKey = process.env.OPENAI_API_KEY;

    // Fallback if no AI
    if (!aiKey) {
      return NextResponse.json({
        posts: [
          `🔥 Just dropped: ${productName}. Everything you need to get started — link in bio!`,
          `If you've been struggling with ${query}, this is for you. ${productName} is live now.`,
          `Stop doing it the hard way. ${productName} just launched ${priceRange ? `for ${priceRange}` : ""}. Link in bio.`,
        ],
        emailSubject: `[New] ${productName} is live — grab it now`,
        hashtags: ["#digitalproducts", "#contentcreator", "#passiveincome", "#onlinebusiness"],
      });
    }

    const topInsights = insights.slice(0, 4).join("\n");

    const prompt = `You are an expert social media marketer. Generate a launch marketing kit for this digital product.

Product: "${productName}"
Topic / niche: "${query}"
Price: "${priceRange || "TBD"}"
Key insights from research:
${topInsights || "No insights provided"}

Return ONLY this JSON (no markdown):
{
  "posts": [
    "First caption — TikTok/Instagram Reels style. Hook in first line. 2-3 sentences. CTA at end.",
    "Second caption — different angle. Personal/story-based tone.",
    "Third caption — value/benefit focused. Show the transformation."
  ],
  "emailSubject": "Email subject line under 60 chars that creates urgency",
  "hashtags": ["#relevant", "#niche", "#hashtags", "6-8 total"]
}

Output ONLY the JSON object.`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${aiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.9,
        max_tokens: 600,
      }),
    });

    if (!res.ok) throw new Error("AI request failed");

    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    const result = JSON.parse(raw) as {
      posts?: string[];
      emailSubject?: string;
      hashtags?: string[];
    };

    return NextResponse.json({
      posts: Array.isArray(result.posts) ? result.posts : [],
      emailSubject: typeof result.emailSubject === "string" ? result.emailSubject : `${productName} is live`,
      hashtags: Array.isArray(result.hashtags) ? result.hashtags : [],
    });
  } catch (err) {
    console.error("[launch/marketing]", err);
    return NextResponse.json({ error: "Marketing generation failed" }, { status: 500 });
  }
}
