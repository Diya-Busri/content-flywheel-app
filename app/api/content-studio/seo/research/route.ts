import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";

export const dynamic = "force-dynamic";

export type KeywordRow = {
  keyword: string;
  monthlySearches: string;
  difficulty: "low" | "medium" | "high";
  trend: "rising" | "stable" | "declining";
};

export type SeoResearchResult = {
  keywords: KeywordRow[];
  relatedKeywords: string[];
  longTailKeywords: string[];
  youtubeSuggestions: string[];
  tiktok: { trendingHashtags: string[]; nicheHashtags: string[] };
  youtube: { seoKeywords: string[] }; // for title/description/tags
  instagram: { hashtagCombinations: string[] }; // up to 30
};

/**
 * POST: Keyword research + platform hashtags for a video topic.
 * Body: { topic: string }
 * Fetches YouTube autocomplete for real suggestions; uses AI for keyword metrics (volume, difficulty, trend) and platform hashtags.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const apiRl = await checkApiRateLimit(userId);

    if (apiRl) return apiRl;

    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    if (!topic) {
      return NextResponse.json({ error: "topic is required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey)
      return NextResponse.json(
        { error: "AI is not configured. Add OPENAI_API_KEY." },
        { status: 503 }
      );

    // YouTube autocomplete (real suggestions from Google)
    let youtubeSuggestions: string[] = [];
    try {
      const acUrl = new URL("https://suggestqueries.google.com/complete/search");
      acUrl.searchParams.set("client", "youtube");
      acUrl.searchParams.set("ds", "yt");
      acUrl.searchParams.set("hl", "en");
      acUrl.searchParams.set("q", topic.slice(0, 80));
      const acRes = await fetch(acUrl.toString(), { next: { revalidate: 0 } });
      const text = await acRes.text();
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        const arr = JSON.parse(match[0]);
        if (Array.isArray(arr) && arr.length >= 2 && Array.isArray(arr[1])) {
          for (const item of arr[1]) {
            if (typeof item === "string") youtubeSuggestions.push(item);
            else if (Array.isArray(item) && typeof item[0] === "string") youtubeSuggestions.push(item[0]);
          }
        }
      }
      youtubeSuggestions = youtubeSuggestions.slice(0, 15);
    } catch {
      // non-fatal
    }

    const systemPrompt = `You are an SEO and keyword research expert for video content. Generate data for the given video topic. Output valid JSON only, no markdown.

Required JSON shape:
{
  "keywords": [
    { "keyword": "exact phrase", "monthlySearches": "e.g. 10K-50K or 1.2M", "difficulty": "low" | "medium" | "high", "trend": "rising" | "stable" | "declining" }
  ],
  "relatedKeywords": ["keyword1", "keyword2", ...],
  "longTailKeywords": ["long tail phrase one", "long tail phrase two", ...],
  "tiktok": {
    "trendingHashtags": ["#trend1", "#trend2", ...],
    "nicheHashtags": ["#niche1", "#niche2", ...]
  },
  "youtube": {
    "seoKeywords": ["tag1", "tag2", ...]
  },
  "instagram": {
    "hashtagCombinations": ["#a #b #c ...", "#d #e #f ...", ...]
  }
}

Rules:
- keywords: 8-12 items. monthlySearches: realistic range (e.g. "5K-20K", "100K-500K"). difficulty = competition level. trend = search trend.
- relatedKeywords: 6-10 terms closely related to the topic.
- longTailKeywords: 6-10 longer phrases (3-5 words) that capture intent.
- tiktok.trendingHashtags: 5-8 currently trending or viral-style hashtags for this topic.
- tiktok.nicheHashtags: 8-12 niche-specific hashtags (smaller but relevant).
- youtube.seoKeywords: 10-15 tags for YouTube title/description/tags (no #).
- instagram.hashtagCombinations: exactly 5-10 strings, each string is one "row" of 20-30 hashtags space-separated (e.g. "#fitness #gym #workout ...") so the creator can pick one row or mix.`;

    const userPrompt = `Video topic: ${topic}\n\nGenerate keyword research and platform-specific hashtags. Use realistic monthly search ranges and difficulty.`;

    const response = await fetchOpenAIWithRetry(
      "https://api.openai.com/v1/chat/completions",
      {
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
          response_format: { type: "json_object" },
          temperature: 0.6,
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json(
        { error: "AI request failed", details: err },
        { status: 502 }
      );
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "No AI response" },
        { status: 502 }
      );
    }

    let parsed: {
      keywords?: Array<{ keyword?: string; monthlySearches?: string; difficulty?: string; trend?: string }>;
      relatedKeywords?: string[];
      longTailKeywords?: string[];
      tiktok?: { trendingHashtags?: string[]; nicheHashtags?: string[] };
      youtube?: { seoKeywords?: string[] };
      instagram?: { hashtagCombinations?: string[] };
    };
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: "Invalid AI response format" },
        { status: 502 }
      );
    }

    const keywords: KeywordRow[] = (Array.isArray(parsed.keywords) ? parsed.keywords : [])
      .slice(0, 15)
      .map((k) => ({
        keyword: typeof k.keyword === "string" ? k.keyword.trim() : "",
        monthlySearches: typeof k.monthlySearches === "string" ? k.monthlySearches.trim() : "—",
        difficulty: ["low", "medium", "high"].includes(k.difficulty ?? "") ? (k.difficulty as KeywordRow["difficulty"]) : "medium",
        trend: ["rising", "stable", "declining"].includes(k.trend ?? "") ? (k.trend as KeywordRow["trend"]) : "stable",
      }))
      .filter((k) => k.keyword);

    const relatedKeywords = Array.isArray(parsed.relatedKeywords)
      ? parsed.relatedKeywords.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, 12)
      : [];
    const longTailKeywords = Array.isArray(parsed.longTailKeywords)
      ? parsed.longTailKeywords.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, 12)
      : [];

    const tiktok = {
      trendingHashtags: Array.isArray(parsed.tiktok?.trendingHashtags)
        ? parsed.tiktok.trendingHashtags.filter((h): h is string => typeof h === "string" && h.trim().length > 0).slice(0, 10)
        : [],
      nicheHashtags: Array.isArray(parsed.tiktok?.nicheHashtags)
        ? parsed.tiktok.nicheHashtags.filter((h): h is string => typeof h === "string" && h.trim().length > 0).slice(0, 15)
        : [],
    };

    const youtube = {
      seoKeywords: Array.isArray(parsed.youtube?.seoKeywords)
        ? parsed.youtube.seoKeywords.filter((t): t is string => typeof t === "string" && t.trim().length > 0).slice(0, 15)
        : [],
    };

    const instagram = {
      hashtagCombinations: Array.isArray(parsed.instagram?.hashtagCombinations)
        ? parsed.instagram.hashtagCombinations.filter((s): s is string => typeof s === "string" && s.trim().length > 0).slice(0, 10)
        : [],
    };

    const result: SeoResearchResult = {
      keywords,
      relatedKeywords,
      longTailKeywords,
      youtubeSuggestions,
      tiktok,
      youtube,
      instagram,
    };

    return NextResponse.json({ topic, result });
  } catch (e) {
    console.error("seo research:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
