import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { db } from "@/db/db";
import { nicheCacheTable } from "@/db/schema/niche-cache-schema";
import { eq, and, gt, desc } from "drizzle-orm";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";

const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_KEY_TRENDING = "trending";

/** In-memory queue: one trending generation at a time to avoid burst 429s. */
let trendingGenerationPromise: Promise<NicheOption[]> | null = null;

type NicheSaturation = "low" | "medium" | "high" | "veryHigh";
type NicheTrend = "rising" | "stable" | "declining";

export type NicheOption = {
  id: string;
  name: string;
  demand: string;
  competition: string;
  revenue: string;
  why: string;
  saturation: NicheSaturation;
  trend: NicheTrend;
  subNiches: string[];
};

type OpenAINiche = {
  title?: string;
  saturation?: string;
  competition?: string;
  revenue?: string;
  trend?: string;
  reason?: string;
  angles?: string[];
};

function normalizeSaturation(s: string | undefined): NicheSaturation {
  if (!s || typeof s !== "string") return "medium";
  const lower = s.trim().toLowerCase().replace(/[\s_-]/g, "");
  if (lower === "low") return "low";
  if (lower === "medium") return "medium";
  if (lower === "high") return "high";
  if (lower === "veryhigh") return "veryHigh";
  return "medium";
}

function normalizeTrend(s: string | undefined): NicheTrend {
  if (!s || typeof s !== "string") return "rising";
  const lower = s.trim().toLowerCase();
  if (lower === "rising" || lower === "stable" || lower === "declining") return lower as NicheTrend;
  return "rising";
}

function mapToNicheOption(raw: OpenAINiche, index: number): NicheOption {
  return {
    id: `openai-${Date.now()}-${index}`,
    name: raw.title ?? "Digital product niche",
    demand: "High",
    competition: raw.competition ?? "Medium",
    revenue: raw.revenue ?? "$1-3k/mo",
    why: raw.reason ?? "",
    saturation: normalizeSaturation(raw.saturation),
    trend: normalizeTrend(raw.trend),
    subNiches: Array.isArray(raw.angles) ? raw.angles : [],
  };
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const apiRl = await checkApiRateLimit(userId);

    if (apiRl) return apiRl;

    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const interests = typeof body.interests === "string" ? body.interests : "";
    const goal = typeof body.goal === "string" ? body.goal : "";
    const exclude: string[] = Array.isArray(body.exclude) ? body.exclude.filter((x: unknown) => typeof x === "string") : [];
    const showTrending = Boolean(body.showTrending);

    console.log("🎯 NICHE GENERATION REQUEST:", { interests, goal, showTrending });

    const useTrendingCache = showTrending || !interests || interests.trim().length === 0;

    if (useTrendingCache) {
      try {
        const cutoff = new Date(Date.now() - CACHE_MAX_AGE_MS);
        const [cached] = await db
          .select()
          .from(nicheCacheTable)
          .where(and(eq(nicheCacheTable.cacheKey, CACHE_KEY_TRENDING), gt(nicheCacheTable.refreshedAt, cutoff)))
          .orderBy(desc(nicheCacheTable.refreshedAt))
          .limit(1);
        if (cached?.niches && Array.isArray(cached.niches) && cached.niches.length >= 6) {
          const niches = (cached.niches as NicheOption[]).slice(0, 6).map((n, i) => ({
            ...n,
            id: `cache-${Date.now()}-${i}`,
          }));
          const excludeSet = new Set(exclude.map((t: string) => t.trim().toLowerCase()));
          const filtered = niches.filter((n) => !excludeSet.has(n.name.trim().toLowerCase()));
          if (filtered.length >= 6) {
            console.log("📦 NICHE CACHE HIT");
            return NextResponse.json(filtered.slice(0, 6));
          }
        }
      } catch (e) {
        console.warn("Niche cache read failed:", e);
      }
    }

    let prompt = "";

    if (showTrending || !interests || interests.trim().length === 0) {
      prompt = `Generate 6 currently trending, high-opportunity digital product niches for 2026.

Focus on what's selling well on Gumroad, Etsy, and TikTok Shop.
Include low to medium competition opportunities.

Return ONLY a JSON array (no markdown, no explanation):
[{
  "title": "Niche title",
  "saturation": "low" | "medium" | "high" | "veryHigh",
  "competition": "Low" | "Medium" | "High",
  "revenue": "$1-3k/mo",
  "trend": "Rising" | "Stable" | "Declining",
  "reason": "Why this niche works",
  "angles": ["Sub-niche 1", "Sub-niche 2", "Sub-niche 3"]
}]`;
    } else {
      prompt = `Generate 6 digital product niches that are DIRECTLY RELATED to: "${interests}"

CRITICAL: Every niche MUST connect to at least one of these interests: ${interests}

User's goal: ${goal}
Already generated (avoid these): ${(exclude as string[]).join(", ") || "None"}

Examples:
- If interests = "relationships, mental health"
  ✅ Generate: Couples therapy worksheets, anxiety journals, relationship guides
  ❌ DON'T: Tech spreadsheets, finance trackers

- If interests = "marketing"
  ✅ Generate: Social media templates, email sequences, content calendars
  ❌ DON'T: Fitness planners, cooking recipes

CURRENT INTERESTS: "${interests}"

Generate 6 niches ONLY about: "${interests}"

Return ONLY a JSON array (no markdown, no explanation):
[{
  "title": "Title directly about ${interests}",
  "saturation": "low" | "medium" | "high" | "veryHigh",
  "competition": "Low" | "Medium" | "High",
  "revenue": "$1-3k/mo",
  "trend": "Rising" | "Stable" | "Declining",
  "reason": "How this connects to ${interests}",
  "angles": ["Sub-niche about ${interests}", "Another angle", "Third angle"]
}]`;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("❌ OPENAI_API_KEY is not set");
      return NextResponse.json(
        { error: "OpenAI API key is not configured. Add OPENAI_API_KEY to your .env.local" },
        { status: 503 }
      );
    }

    async function callOpenAI(): Promise<Response> {
      return fetchOpenAIWithRetry(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            // gpt-4o-mini: niche suggestions, non-critical
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content:
                  "You are a digital product niche expert. Always return valid JSON arrays only, no markdown formatting.",
              },
              { role: "user", content: prompt },
            ],
            temperature: 0.8,
            max_tokens: 2000,
          }),
        },
        {
          onRetry: (attempt, delayMs) =>
            console.log(`🔄 Niche API 429/5xx, retry ${attempt} in ${delayMs / 1000}s`),
        }
      );
    }

    async function generateTrendingNiches(): Promise<NicheOption[]> {
      const response = await callOpenAI();
      if (!response.ok) {
        const errorText = await response.text();
        throw { status: response.status, errorText };
      }
      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content ?? "";
      let jsonText = content.trim();
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      }
      const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
      const rawNiches: OpenAINiche[] = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      return rawNiches.slice(0, 6).map(mapToNicheOption);
    }

    let niches: NicheOption[];

    if (useTrendingCache) {
      const runGeneration = async (): Promise<NicheOption[]> => {
        try {
          return await generateTrendingNiches();
        } finally {
          trendingGenerationPromise = null;
        }
      };
      try {
        if (trendingGenerationPromise) {
          try {
            niches = await trendingGenerationPromise;
          } catch {
            niches = await runGeneration();
          }
        } else {
          trendingGenerationPromise = runGeneration();
          niches = await trendingGenerationPromise;
        }
      } catch (err: unknown) {
        const status = (err as { status?: number })?.status;
        const errorText = (err as { errorText?: string })?.errorText ?? "";
        if (status === 429) {
          return NextResponse.json(
            {
              error:
                "We're experiencing high demand. We tried several times—please wait a moment and click Retry.",
              details: errorText,
            },
            { status: 429 }
          );
        }
        throw err;
      }
      try {
        await db.delete(nicheCacheTable).where(eq(nicheCacheTable.cacheKey, CACHE_KEY_TRENDING));
        await db.insert(nicheCacheTable).values({
          cacheKey: CACHE_KEY_TRENDING,
          niches: niches as unknown[],
          refreshedAt: new Date(),
        });
      } catch (e) {
        console.warn("Niche cache write failed:", e);
      }
      const excludeSet = new Set(exclude.map((t: string) => t.trim().toLowerCase()));
      const filtered = niches.filter((n) => !excludeSet.has(n.name.trim().toLowerCase()));
      return NextResponse.json(filtered.slice(0, 6));
    }

    const response = await callOpenAI();
    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ OpenAI Error:", response.status, errorText);
      let userMessage = "OpenAI API failed. Please try again.";
      if (response.status === 401) {
        userMessage = "Invalid OpenAI API key. Check OPENAI_API_KEY in your environment.";
      } else if (response.status === 429) {
        userMessage =
          "We're experiencing high demand. We tried several times—please wait a moment and click Retry.";
      } else if (response.status >= 500) {
        userMessage = "OpenAI service is temporarily unavailable. Please try again in a few minutes.";
      }
      return NextResponse.json(
        { error: userMessage, details: errorText },
        { status: response.status === 401 ? 503 : 502 }
      );
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    console.log("📥 Raw OpenAI response:", content.slice(0, 200) + (content.length > 200 ? "..." : ""));
    let jsonText = content.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    }
    const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
    const rawNiches: OpenAINiche[] = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    niches = rawNiches.slice(0, 6).map(mapToNicheOption);
    console.log("✅ Parsed niches:", niches.map((n) => n.name));

    if (!showTrending && interests.trim().length > 0) {
      const interestKeywords = interests
        .toLowerCase()
        .split(/[,\s]+/)
        .map((w: string) => w.trim())
        .filter((w: string) => w.length > 3);
      const validatedNiches = niches.filter((niche) => {
        const nicheText = `${niche.name} ${niche.why}`.toLowerCase();
        const hasMatch = interestKeywords.some((keyword: string) => nicheText.includes(keyword));
        if (!hasMatch) {
          console.warn(`⚠️ Rejected: "${niche.name}" - doesn't match interests`);
        }
        return hasMatch;
      });
      if (validatedNiches.length < 4) {
        console.error("Too many irrelevant niches generated");
        return NextResponse.json(
          { error: "Generated niches did not match your interests. Please try again." },
          { status: 500 }
        );
      }
      const excludeSet = new Set(exclude.map((t: string) => t.trim().toLowerCase()));
      const filtered = validatedNiches.filter((n) => !excludeSet.has(n.name.trim().toLowerCase()));
      return NextResponse.json(filtered.slice(0, 6));
    }

    const excludeSet = new Set(exclude.map((t: string) => t.trim().toLowerCase()));
    const filtered = niches.filter((n) => !excludeSet.has(n.name.trim().toLowerCase()));
    return NextResponse.json(filtered.slice(0, 6));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Niche generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate niches", details: message },
      { status: 500 }
    );
  }
}
