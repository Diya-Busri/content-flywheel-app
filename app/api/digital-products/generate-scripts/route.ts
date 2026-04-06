/**
 * POST: Generate 4 video script variations for a digital product in one API call.
 * Angles: Story, Problem/Solution, Social Proof/Results, Curiosity/Controversy.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";
import { cleanProductTitle } from "@/lib/product-title";
import { getVideoLengthOptionOrDefault } from "@/lib/video-length-options";
import { getBrandVoice } from "@/lib/brand-voice";

export type YouTubeMetrics = {
  projectedViews?: string;
  retentionTarget?: string;
  monetizationFriendly?: boolean;
  adRevenuePer1k?: string;
  sponsorAppeal?: string;
  sponsorAppealNote?: string;
};

export type GeneratedScriptItem = {
  id: string;
  title: string;
  length: number;
  hook: string;
  body: string;
  cta: string;
  youtube_metrics?: YouTubeMetrics;
};

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const apiRl = await checkApiRateLimit(userId);

    if (apiRl) return apiRl;

    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const [body, brandVoice] = await Promise.all([
      request.json().catch(() => ({})),
      getBrandVoice(userId),
    ]);
    const productId = typeof body.productId === "string" ? body.productId.trim() : "";
    const youtubeChannelId = typeof body.youtubeChannelId === "string" ? body.youtubeChannelId.trim() : "";
    const channelName = typeof body.channelName === "string" ? body.channelName.trim() : "";
    const subscriberCount = typeof body.subscriberCount === "number" ? body.subscriberCount : undefined;
    const topicBody = body.topic;
    const topic =
      topicBody != null && typeof topicBody === "object"
        ? {
            title: typeof topicBody.title === "string" ? topicBody.title.trim() : "",
            hook_angle: typeof topicBody.hook_angle === "string" ? topicBody.hook_angle.trim() : "",
          }
        : typeof topicBody === "string"
          ? { title: topicBody.trim(), hook_angle: "" }
          : null;
    const niche = typeof body.niche === "string" ? body.niche.trim() : "";
    const contentStyle = typeof body.contentStyle === "string" ? body.contentStyle.trim() : "";
    const intent = typeof body.intent === "string" ? body.intent.trim() : "";

    const targetDurationSec = typeof body.targetDurationSec === "number" ? body.targetDurationSec : 30;
    const lengthOpt = getVideoLengthOptionOrDefault(targetDurationSec);
    const { durationSec, wordsMin, wordsMax } = lengthOpt;

    let title: string;
    let description: string;
    let nicheRes: string;
    const useYouTubePrompt = Boolean(youtubeChannelId || channelName);

    if (productId) {
      const [product] = await db
        .select()
        .from(productsTable)
        .where(
          and(
            eq(productsTable.id, productId),
            eq(productsTable.userId, userId),
            isNull(productsTable.deletedAt)
          )
        );
      if (!product) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }
      const marketing = (product.marketingAssets ?? {}) as {
        productTitle?: string;
        productDescription?: string;
      };
      const rawTitle = (marketing.productTitle ?? product.title ?? "").trim();
      title = cleanProductTitle(rawTitle) || rawTitle || "Product";
      description = (marketing.productDescription ?? "").trim() || "";
      nicheRes = (product.niche ?? "").trim() || "general audience";
    } else if (useYouTubePrompt) {
      title = (topic?.title ?? "").trim() || "YouTube video";
      description = topic?.hook_angle ?? "";
      nicheRes = niche.trim() || "general audience";
    } else if (topic && topic.title) {
      title = topic.title;
      description = topic.hook_angle || "";
      nicheRes = niche.trim() || "general audience";
    } else {
      return NextResponse.json(
        { error: "Either productId, (youtubeChannelId or channelName), or topic (with title) required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 503 }
      );
    }

    let systemPrompt: string;
    let userPrompt: string;

    if (useYouTubePrompt) {
      const subs = subscriberCount ?? 0;
      const tier =
        subs < 1_000
          ? "<1k subs: Focus on searchable topics, evergreen content, tutorial-style"
          : subs < 10_000
            ? "1k-10k subs: Mix trending + evergreen, series potential, viewer retention"
            : subs < 100_000
              ? "10k-100k subs: Trending topics, clickable angles, community engagement"
              : "100k+ subs: Trend-jacking, viral potential, brand deals";

      systemPrompt = `You are an expert YouTube growth and monetization scriptwriter.
Write scripts optimized for the YouTube algorithm, watch time, and monetization.

Rules:
- Hook (first 3-9 seconds) is CRITICAL for retention — pattern interrupt, curiosity gap, or bold claim
- Structure for watch time: open loop, payoff in body, clear CTA
- Ad-friendly and sponsor-friendly language where relevant
- Each script should support: high CTR, retention, engagement signals (likes, comments, subscribe)
${brandVoice ? `\n${brandVoice}` : ""}
Return only valid JSON with a "scripts" array. Each item has title, hook, body, cta (strings), and optionally youtube_metrics (object). No markdown, no code fences.`;

      userPrompt = `Generate YouTube video script angles for growth and monetization.

Channel Context:
- Channel Name: ${channelName || "(not provided)"}
${youtubeChannelId ? `- Channel ID: ${youtubeChannelId}` : ""}
- Current Subscribers: ${subscriberCount != null ? subscriberCount.toLocaleString() : "unknown"}
- Niche: ${nicheRes}
- Content Style: ${contentStyle || "general"}
- Topic: ${title}${description ? `\n- Hook angle / focus: ${description}` : ""}

Goal: Create scripts optimized for YouTube algorithm, watch time, and monetization.

For channels with:
- <1k subs: Focus on searchable topics, evergreen content, tutorial-style
- 1k-10k subs: Mix trending + evergreen, series potential, viewer retention
- 10k-100k subs: Trending topics, clickable angles, community engagement
- 100k+ subs: Trend-jacking, viral potential, brand deals

This channel fits: ${tier}

Generate 4 script angles optimized for:
1. High click-through rate (compelling hooks)
2. Watch time retention (storytelling structure)
3. Algorithm favor (engagement signals)
4. Monetization (ad-friendly, sponsor potential)

Each script: angle name, hook (first 3-9 seconds), body (main content), cta (subscribe/like/comment/next video). Target ${durationSec}-second video; word count ${wordsMin}–${wordsMax} per script.

Also include YouTube-specific performance estimates per script in a "youtube_metrics" object:
- projected_views: string, e.g. "5k-15k" (projected views first 7 days based on channel size + niche)
- retention_target: string, e.g. "45-60%"
- monetization_friendly: boolean
- ad_revenue_per_1k: string, e.g. "£8-25" or "$10-30" (CPM estimate for niche)
- sponsor_appeal: string, e.g. "Low" | "Medium" | "High"
- sponsor_appeal_note: optional string, e.g. "good for brand deals"

Return ONLY valid JSON:
{
  "scripts": [
    { "title": "Story Angle", "hook": "...", "body": "...", "cta": "...", "youtube_metrics": { "projected_views": "5k-15k", "retention_target": "45-60%", "monetization_friendly": true, "ad_revenue_per_1k": "£8-25", "sponsor_appeal": "Medium", "sponsor_appeal_note": "good for brand deals" } },
    { "title": "Problem/Solution Angle", "hook": "...", "body": "...", "cta": "...", "youtube_metrics": { ... } },
    { "title": "Social Proof/Results Angle", "hook": "...", "body": "...", "cta": "...", "youtube_metrics": { ... } },
    { "title": "Curiosity/Controversy Angle", "hook": "...", "body": "...", "cta": "...", "youtube_metrics": { ... } }
  ]
}`;
    } else {
      systemPrompt = `You are an expert short-form video scriptwriter for TikTok and Instagram Reels.
Write scripts that feel human, conversational and emotionally engaging.

Rules:
- Hook MUST open with a pain point, bold claim, or curiosity gap — never with the product name
- Never start with "Meet [name]" or "Are you struggling" — be more specific and real
- The product name should only appear ONCE in the entire script, naturally
- Write like a real person talking, not an ad
- Use short punchy sentences. Max 15 words per sentence.
- Body should agitate the problem before presenting the solution
- CTA should feel urgent but not desperate

Pain point hooks that work:
- "I wasted 3 years trying to figure this out..."
- "Nobody talks about why journaling actually fails..."
- "The reason you keep starting over has nothing to do with motivation..."

Write the script in this structure:
HOOK (0-3s): One sentence. Pain point or curiosity gap only.
BODY (3-25s): Agitate the problem (2 sentences), then introduce the solution naturally (2-3 sentences), then social proof or outcome (1-2 sentences)
CTA (25-30s): One clear action. Urgent but natural.
${brandVoice ? `\n${brandVoice}` : ""}
Return only valid JSON with a "scripts" array. Each item has title, hook, body, cta (strings). No markdown, no code fences.`;

      const contextLabel = productId ? "PRODUCT" : "TOPIC / CHANNEL";
      const contextLines = productId
        ? `- Name: "${title}"
- Description: ${description || "(none provided)"}
- Niche/audience: ${nicheRes}`
        : `- Topic/Video title: "${title}"
- Hook angle / focus: ${description || "(none provided)"}
- Niche: ${nicheRes}${channelName ? `\n- Channel name: ${channelName}` : ""}${youtubeChannelId ? `\n- Channel ID: ${youtubeChannelId}` : ""}`;

      userPrompt = `Generate exactly 4 scripts. Each script must follow the rules and structure above. Target ${durationSec}-second video; total word count ${wordsMin}–${wordsMax} words per script.

${contextLabel}:
${contextLines}

Generate 4 scripts with these angles (in this order):
1. "Story Angle" — transformation or relatable scenario; human, not "Meet Sarah"
2. "Problem/Solution Angle" — specific pain point hook; agitate then solution
3. "Social Proof/Results Angle" — results or numbers; outcome-focused
4. "Curiosity/Controversy Angle" — curiosity gap or bold claim; reveal value naturally

Return ONLY valid JSON:
{
  "scripts": [
    { "title": "Story Angle", "hook": "...", "body": "...", "cta": "..." },
    { "title": "Problem/Solution Angle", "hook": "...", "body": "...", "cta": "..." },
    { "title": "Social Proof/Results Angle", "hook": "...", "body": "...", "cta": "..." },
    { "title": "Curiosity/Controversy Angle", "hook": "...", "body": "...", "cta": "..." }
  ]
}`;
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
        temperature: 0.7,
        max_tokens: 2500,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[digital-products/generate-scripts] OpenAI error:", response.status, err);
      return NextResponse.json(
        { error: "Failed to generate scripts" },
        { status: 502 }
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    let content = (data.choices?.[0]?.message?.content ?? "").trim();
    if (content.startsWith("```")) {
      content = content.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }
    type RawScript = {
      title?: string;
      hook?: string;
      body?: string;
      cta?: string;
      youtube_metrics?: {
        projected_views?: string;
        retention_target?: string;
        monetization_friendly?: boolean;
        ad_revenue_per_1k?: string;
        sponsor_appeal?: string;
        sponsor_appeal_note?: string;
      };
    };
    const parsed = JSON.parse(content) as { scripts?: RawScript[] };
    const raw = Array.isArray(parsed.scripts) ? parsed.scripts : [];
    const defaultTitles = ["Story Angle", "Problem/Solution Angle", "Social Proof/Results Angle", "Curiosity/Controversy Angle"];

    const scripts: GeneratedScriptItem[] = raw.slice(0, 4).map((s, i) => {
      const ym = s.youtube_metrics;
      const youtube_metrics: YouTubeMetrics | undefined =
        ym && (ym.projected_views ?? ym.retention_target ?? ym.sponsor_appeal)
          ? {
              projectedViews: typeof ym.projected_views === "string" ? ym.projected_views : undefined,
              retentionTarget: typeof ym.retention_target === "string" ? ym.retention_target : undefined,
              monetizationFriendly: typeof ym.monetization_friendly === "boolean" ? ym.monetization_friendly : undefined,
              adRevenuePer1k: typeof ym.ad_revenue_per_1k === "string" ? ym.ad_revenue_per_1k : undefined,
              sponsorAppeal: typeof ym.sponsor_appeal === "string" ? ym.sponsor_appeal : undefined,
              sponsorAppealNote: typeof ym.sponsor_appeal_note === "string" ? ym.sponsor_appeal_note : undefined,
            }
          : undefined;
      return {
        id: `gen-${i + 1}`,
        title: typeof s.title === "string" ? s.title : defaultTitles[i] ?? `Script ${i + 1}`,
        length: durationSec,
        hook: typeof s.hook === "string" ? s.hook.trim() : "",
        body: typeof s.body === "string" ? s.body.trim() : "",
        cta: typeof s.cta === "string" ? s.cta.trim() : "",
        ...(youtube_metrics && Object.keys(youtube_metrics).length > 0 && { youtube_metrics }),
      };
    });

    return NextResponse.json({ scripts });
  } catch (e) {
    console.error("[digital-products/generate-scripts]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to generate scripts" },
      { status: 500 }
    );
  }
}
