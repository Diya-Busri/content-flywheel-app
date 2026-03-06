import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { db } from "@/db/db";
import { brandProfilesTable } from "@/db/schema/brand-profiles-schema";
import { eq } from "drizzle-orm";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";

export const dynamic = "force-dynamic";

export type TrendLifecycle = "rising" | "peak" | "declining";

export type PlatformTrend = {
  id: string;
  title: string;
  description: string;
  lifecycle: TrendLifecycle;
  suggestedAngles: string[];
  hashtags: string[];
  sounds: string[]; // TikTok/Instagram; for YouTube could be "format" names
  formats: string[];
};

export type HistoricalTrend = {
  title: string;
  whyItWorked: string;
  bestPlatform: string;
};

export type PlatformTrendsData = {
  platform: "tiktok" | "youtube" | "instagram";
  platformLabel: string;
  trends: PlatformTrend[];
};

export type TrendsResponse = {
  niche: string;
  platformData: PlatformTrendsData[];
  historical: HistoricalTrend[];
};

type OpenAITrend = {
  title?: string;
  description?: string;
  lifecycle?: string;
  suggestedAngles?: string[];
  hashtags?: string[];
  sounds?: string[];
  formats?: string[];
};

type OpenAIHistorical = {
  title?: string;
  whyItWorked?: string;
  bestPlatform?: string;
};

function normalizeLifecycle(s: string | undefined): TrendLifecycle {
  if (!s || typeof s !== "string") return "rising";
  const lower = s.trim().toLowerCase();
  if (lower === "rising" || lower === "peak" || lower === "declining") return lower as TrendLifecycle;
  return "rising";
}

function mapTrend(raw: OpenAITrend, index: number, platform: string): PlatformTrend {
  return {
    id: `trend-${platform}-${Date.now()}-${index}`,
    title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : "Trend",
    description: typeof raw.description === "string" && raw.description.trim() ? raw.description.trim() : "",
    lifecycle: normalizeLifecycle(raw.lifecycle),
    suggestedAngles: Array.isArray(raw.suggestedAngles)
      ? raw.suggestedAngles.filter((a): a is string => typeof a === "string" && a.trim().length > 0).slice(0, 5)
      : [],
    hashtags: Array.isArray(raw.hashtags)
      ? raw.hashtags.filter((h): h is string => typeof h === "string" && h.trim().length > 0).slice(0, 8)
      : [],
    sounds: Array.isArray(raw.sounds)
      ? raw.sounds.filter((s): s is string => typeof s === "string" && s.trim().length > 0).slice(0, 5)
      : [],
    formats: Array.isArray(raw.formats)
      ? raw.formats.filter((f): f is string => typeof f === "string" && f.trim().length > 0).slice(0, 5)
      : [],
  };
}

/**
 * POST: Get real-time-style trending topics for the user's niche.
 * Body: { niche?: string }
 * Uses brand profile niche if omitted. Returns platform-specific trends, lifecycle, angles, hashtags/sounds/formats, and historical data.
 * Structure is ready for TikTok Trends API, YouTube Trending API, and Google Trends integration when keys are added.
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

    let niche = "";
    const body = await request.json().catch(() => ({}));
    if (typeof body.niche === "string" && body.niche.trim()) {
      niche = body.niche.trim();
    } else {
      const [row] = await db
        .select({ nicheIndustry: brandProfilesTable.nicheIndustry })
        .from(brandProfilesTable)
        .where(eq(brandProfilesTable.userId, userId));
      niche = (row?.nicheIndustry ?? "").trim();
    }

    if (!niche) {
      return NextResponse.json(
        { error: "No niche set. Save a niche in Niche Research or pass niche in the request." },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI is not configured. Add OPENAI_API_KEY." },
        { status: 503 }
      );
    }

    const prompt = `You are a trend analyst for short-form video (TikTok, YouTube Shorts, Instagram Reels). For the niche "${niche}", generate CURRENT trending topics that creators in this niche should know.

Return a single JSON object (no markdown, no code fence) with this exact structure:

{
  "tiktok": {
    "trends": [
      {
        "title": "Short trend title",
        "description": "1-2 sentences on what this trend is and why it's hot",
        "lifecycle": "rising" | "peak" | "declining",
        "suggestedAngles": ["Angle 1", "Angle 2", "Angle 3"],
        "hashtags": ["#hashtag1", "#hashtag2"],
        "sounds": ["Sound name or trend type", "Another"],
        "formats": ["POV", "Get ready with me", "Storytime"]
      }
    ]
  },
  "youtube": {
    "trends": [
      {
        "title": "Trend title",
        "description": "Why it's trending on Shorts",
        "lifecycle": "rising" | "peak" | "declining",
        "suggestedAngles": ["Angle 1", "Angle 2"],
        "hashtags": ["tag1", "tag2"],
        "sounds": [],
        "formats": ["Vertical format", "Hook style"]
      }
    ]
  },
  "instagram": {
    "trends": [
      {
        "title": "Trend title",
        "description": "Why it's trending on Reels",
        "lifecycle": "rising" | "peak" | "declining",
        "suggestedAngles": ["Angle 1", "Angle 2"],
        "hashtags": ["#hashtag1"],
        "sounds": ["Audio trend"],
        "formats": ["Reels format"]
      }
    ]
  },
  "historical": [
    {
      "title": "Trend or topic that worked last year in this niche",
      "whyItWorked": "Brief reason",
      "bestPlatform": "TikTok" | "YouTube" | "Instagram"
    }
  ]
}

Generate 4-5 trends per platform. historical: 3-5 items. Be specific to the niche "${niche}". Use realistic hashtags, sounds, and formats.`;

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
            {
              role: "system",
              content: "You are a trend analyst. Return only a valid JSON object. No markdown.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        }),
      },
      { onRetry: (a, d) => console.log(`[content-studio/trends] Retry ${a} in ${d / 1000}s`) }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return NextResponse.json(
          { error: "High demand. Please wait and try again." },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: "AI request failed. Please try again." },
        { status: 502 }
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    let jsonText = content.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    }
    const objMatch = jsonText.match(/\{[\s\S]*\}/);
    const raw = objMatch ? JSON.parse(objMatch[0]) : {};

    const platformData: PlatformTrendsData[] = [];
    const platforms = [
      { key: "tiktok", label: "TikTok" },
      { key: "youtube", label: "YouTube Shorts" },
      { key: "instagram", label: "Instagram Reels" },
    ] as const;

    for (const { key, label } of platforms) {
      const block = raw[key];
      const arr = Array.isArray(block?.trends) ? block.trends : [];
      const trends = arr.slice(0, 6).map((t: OpenAITrend, i: number) => mapTrend(t, i, key));
      platformData.push({ platform: key, platformLabel: label, trends });
    }

    const rawHist = Array.isArray(raw.historical) ? raw.historical : [];
    const historical: HistoricalTrend[] = rawHist.slice(0, 5).map((h: OpenAIHistorical) => ({
      title: typeof h.title === "string" && h.title.trim() ? h.title.trim() : "Past trend",
      whyItWorked: typeof h.whyItWorked === "string" && h.whyItWorked.trim() ? h.whyItWorked.trim() : "",
      bestPlatform: ["TikTok", "YouTube", "Instagram"].includes(String(h.bestPlatform)) ? String(h.bestPlatform) : "TikTok",
    }));

    return NextResponse.json({
      niche,
      platformData,
      historical,
    } as TrendsResponse);
  } catch (err) {
    console.error("[content-studio/trends]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load trends" },
      { status: 500 }
    );
  }
}
