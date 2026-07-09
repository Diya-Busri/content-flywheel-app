export const dynamic = "force-dynamic";
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
  // Extended research fields (populated when available)
  targetCustomer?: string;
  sellingPlatforms?: string[];
  marketingAngle?: string;
  priceRange?: string;
  confidenceScore?: "High" | "Medium" | "Low";
};

type OpenAINiche = {
  title?: string;
  saturation?: string;
  competition?: string;
  revenue?: string;
  trend?: string;
  reason?: string;
  angles?: string[];
  targetCustomer?: string;
  sellingPlatforms?: string[];
  marketingAngle?: string;
  priceRange?: string;
  confidenceScore?: string;
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
  const confidence = raw.confidenceScore?.trim().toLowerCase();
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
    targetCustomer: raw.targetCustomer ?? undefined,
    sellingPlatforms: Array.isArray(raw.sellingPlatforms) ? raw.sellingPlatforms : undefined,
    marketingAngle: raw.marketingAngle ?? undefined,
    priceRange: raw.priceRange ?? undefined,
    confidenceScore: confidence === "high" ? "High" : confidence === "medium" ? "Medium" : confidence === "low" ? "Low" : undefined,
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

    const JSON_SHAPE = `[{
  "title": "Hyper-specific niche name — format: [Specific product type] for [Specific person in specific situation]. NOT 'Wellness Journal' but 'ADHD Planner for UK University Students'.",
  "saturation": "low" | "medium" | "high" | "veryHigh",
  "competition": "Low" | "Medium" | "High",
  "revenue": "$X-Yk/mo (realistic range for someone new to this niche)",
  "trend": "rising" | "stable" | "declining",
  "reason": "3-4 sentence market analysis. Who is the buyer exactly? What specific moment triggers the purchase? Why is there a gap in the market right now? What makes this niche winnable without a large audience? Write like someone who has actually sold in this space — no generic claims, no invented statistics.",
  "angles": ["Specific product angle or sub-niche 1", "Specific product angle or sub-niche 2", "Specific product angle or sub-niche 3"],
  "targetCustomer": "One sentence: the exact person (e.g. 'Women in their 30s working NHS shifts who want to batch-cook but have no structured system for their unpredictable rota')",
  "sellingPlatforms": ["Primary platform e.g. Etsy", "Secondary e.g. TikTok Shop", "Optional third e.g. Gumroad"],
  "marketingAngle": "The specific content hook that drives discovery for this niche (e.g. 'A day-in-the-life reel of prepping meals on a rest day — show the chaos, then show the solution'). Be specific to this audience.",
  "priceRange": "$X-Y (sweet spot for this audience and format)",
  "confidenceScore": "High" | "Medium" | "Low"
}]`;

    if (showTrending || !interests || interests.trim().length === 0) {
      prompt = `Identify 6 high-opportunity digital product niches for 2026 that are currently performing well on Gumroad, Etsy, TikTok Shop, and Payhip.

These must be hyper-specific — not "Wellness Journal" but "ADHD Study Planner for University Students" or "Budget Spreadsheet for UK First-Time Buyers".

For each niche, reason through:
- WHO is the exact buyer (role, life stage, specific situation)?
- WHAT specific frustration makes them pull out their wallet for a $17-67 PDF or template?
- WHY does this particular angle have manageable competition (new segment, underserved format, recent life-event trigger)?
- WHICH platforms are buyers and creators already active on for this topic?
- WHAT content format reliably drives traffic to this type of product?

Prioritise niches where:
1. The buyer has an urgent, specific pain point — not just a vague interest
2. A focused digital product ($17-67) is the obvious, accessible solution
3. The creator can produce content from lived experience or a clear perspective
4. Short-form video or Pinterest content about this problem already gets strong engagement

Do NOT invent statistics or make up search volumes. Reason from observable market patterns and buyer behaviour.

Return ONLY a JSON array (no markdown, no explanation):
${JSON_SHAPE}`;
    } else {
      prompt = `Identify 6 high-opportunity digital product niches within: "${interests}"

CRITICAL: Every niche MUST be directly rooted in these interests: ${interests}
User's goal: ${goal}
Already shown (avoid these): ${(exclude as string[]).join(", ") || "None"}

These must be hyper-specific — not "${interests} Planner" but a named product for a named person with a named problem.

For each niche, work through:
- WHO is the exact buyer within this topic? (specific life stage, role, or situation)
- WHAT specific frustration within "${interests}" makes them willing to pay $17-67 for a digital product?
- WHY is this particular angle in "${interests}" still winnable — what's the gap?
- WHICH platforms are buyers and creators already active on for this angle?
- WHAT content hook drives traffic to this type of product?

Do NOT:
- Generate niches unrelated to: "${interests}"
- Invent statistics or precise search data
- Use vague titles like "${interests} Guide" or "${interests} Workbook"

Do:
- Be as specific as "Meal Prep Tracker for UK Night Shift Nurses" or "AI Prompt Pack for Freelance Estate Agents"
- Reason from buyer psychology and real marketplace patterns

Return ONLY a JSON array (no markdown, no explanation):
${JSON_SHAPE}`;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("❌ OPENAI_API_KEY is not set");
      return NextResponse.json(
        { error: "OpenAI API key is not configured. Add OPENAI_API_KEY to your .env.local" },
        { status: 503 }
      );
    }

    const callOpenAI = async (): Promise<Response> => {
      return fetchOpenAIWithRetry(
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
                content:
                  "You are a digital product market research analyst who has studied what actually sells on Gumroad, Etsy, TikTok Shop, and Payhip. You specialise in identifying hyper-specific, winnable niches by reasoning from buyer psychology, marketplace patterns, and content trends. You never invent statistics or precise data you cannot know. You think in terms of specific people with specific problems, not broad categories. Return only valid JSON arrays — no markdown, no code fences, no explanation.",
              },
              { role: "user", content: prompt },
            ],
            temperature: 0.75,
            max_tokens: 3500,
          }),
        },
        {
          onRetry: (attempt, delayMs) =>
            console.log(`🔄 Niche API 429/5xx, retry ${attempt} in ${delayMs / 1000}s`),
        }
      );
    };

    const generateTrendingNiches = async (): Promise<NicheOption[]> => {
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
    };

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
