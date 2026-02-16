import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { renderJobsTable } from "@/db/schema/library-schema";
import { eq, and } from "drizzle-orm";

export type PostContentResponse = {
  caption: string;
  hashtags: string[];
  titleVariations: string[];
  platformTips: { platform: string; bestTimes: string }[];
};

/**
 * GET: Generate post content (caption, hashtags, titles, platform tips) for a completed video.
 * videoId = render job id. Requires job to be completed.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY not configured. Post content generation unavailable." },
        { status: 503 }
      );
    }

    const { videoId } = await params;
    if (!videoId) return NextResponse.json({ error: "videoId required" }, { status: 400 });

    const [job] = await db
      .select()
      .from(renderJobsTable)
      .where(and(eq(renderJobsTable.id, videoId), eq(renderJobsTable.userId, userId)))
      .limit(1);

    if (!job) return NextResponse.json({ error: "Video not found" }, { status: 404 });
    if (job.status !== "completed") {
      return NextResponse.json(
        { error: "Video not ready. Post content is available after render completes." },
        { status: 400 }
      );
    }

    const payload = job.payload as {
      productDescription?: string;
      productLink?: string;
      script?: { fullScript?: string; scenes?: unknown };
    } | undefined;

    const script = payload?.script;
    const fullScript = typeof script === "object" && script && "fullScript" in script
      ? String(script.fullScript ?? "").trim()
      : "";
    const productDescription = String(payload?.productDescription ?? "").trim();

    if (!fullScript) {
      return NextResponse.json(
        { error: "No script found for this video. Cannot generate post content." },
        { status: 400 }
      );
    }

    const systemPrompt = `You are a viral social media content strategist. Generate post content for a TikTok Shop / short-form product video.

OUTPUT FORMAT (valid JSON only, no markdown):
{
  "caption": "2-3 sentence engaging caption with 2-4 relevant emojis. Punchy, scroll-stopping, fits TikTok/Reels.",
  "hashtags": ["hashtag1", "hashtag2", ...],
  "titleVariations": ["Title A for A/B test", "Title B for A/B test", "Title C for A/B test"],
  "platformTips": [
    { "platform": "TikTok", "bestTimes": "6-9 AM, 12-2 PM, 7-9 PM (local)" },
    { "platform": "Instagram Reels", "bestTimes": "11 AM-1 PM, 7-9 PM (local)" },
    { "platform": "YouTube Shorts", "bestTimes": "2-4 PM, 8-11 PM (local)" }
  ]
}

RULES:
- Caption: 2-3 sentences max. Engaging, conversational. Use emojis that fit the product/vibe.
- Hashtags: 8-10 platform-specific hashtags. Mix niche + broader. No spaces in hashtags. Lowercase.
- Title variations: 3 distinct options for A/B testing. Short, punchy, curiosity-driven. Max ~60 chars each.
- Platform tips: Best posting times for TikTok, Instagram Reels, YouTube Shorts. Use common optimal windows (local time).`;

    const userPrompt = `Product description (for context):\n${productDescription || "Not provided"}\n\nVideo script:\n${fullScript}\n\nGenerate caption, hashtags, title variations, and platform tips. Output valid JSON only.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 1024,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[post-content] OpenAI error:", response.status, err);
      return NextResponse.json(
        { error: "Failed to generate post content. Try again." },
        { status: 500 }
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content ?? "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[post-content] No JSON in OpenAI response:", text.slice(0, 300));
      return NextResponse.json(
        { error: "Invalid response from AI. Try again." },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      caption?: string;
      hashtags?: string[];
      titleVariations?: string[];
      platformTips?: Array<{ platform?: string; bestTimes?: string }>;
    };

    const result: PostContentResponse = {
      caption: String(parsed.caption ?? "").trim() || "Check out this product! 🔥",
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.map(String).filter(Boolean) : [],
      titleVariations: Array.isArray(parsed.titleVariations) ? parsed.titleVariations.map(String).filter(Boolean).slice(0, 3) : [],
      platformTips: Array.isArray(parsed.platformTips)
        ? parsed.platformTips
            .filter((t) => t && (t.platform || t.bestTimes))
            .map((t) => ({ platform: String(t.platform ?? "Other"), bestTimes: String(t.bestTimes ?? "") }))
        : [],
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("[post-content] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate post content" },
      { status: 500 }
    );
  }
}
