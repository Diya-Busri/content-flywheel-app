import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { contentBundlesTable, ContentAssets } from "@/db/schema/bundles-schema";
import { designsTable, DesignData, DesignElement } from "@/db/schema/designs-schema";
import { eq, and, isNull, asc } from "drizzle-orm";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";

export const dynamic = "force-dynamic";

const TONE_GUIDE: Record<string, string> = {
  // Original 6
  "minimal-luxury":     "elegant, aspirational, refined — short sentences, premium vocabulary, no slang, subtle urgency",
  "dark-aesthetic":     "edgy, moody, mysterious — cryptic phrasing, bold statements, low-key confidence, dark poetry vibes",
  "wellness":           "warm, nurturing, mindful — gentle encouragement, inclusive language, breathe-and-grow energy",
  "clean-productivity": "clear, direct, action-oriented — crisp bullet logic, efficiency-first, no fluff, measurable outcomes",
  "faceless-creator":   "relatable, system-focused, educational — 'I built a system', 'here's what actually works', income transparency energy",
  "modern-business":    "professional, authoritative, results-driven — data-backed, executive voice, ROI language",
  // New 8
  "viral-storytelling": "cinematic, emotional, curiosity-driven — open loops, dramatic reveals, 'nobody talks about this' energy, storytelling arc with emotional payoff",
  "aggressive-viral":   "fast, loud, high-energy — punchy short sentences, ALL CAPS moments, fire metaphors, no-BS money/gym/grind mindset language",
  "educational-pro":    "structured, clear, authoritative — numbered lists, 'here's what most people miss', teacherly but not boring, every sentence earns its place",
  "soft-feminine":      "gentle, encouraging, beautiful — soft affirmations, poetic imagery, 'you deserve this', warm self-care energy, no hustle culture",
  "tech-minimal":       "precise, futuristic, smart — clean logic, data-forward, slight sci-fi edge, 'this is the future', startup pitch meets social media",
  "luxury-editorial":   "editorial, sophisticated, understated — magazine-level prose, drop the hype entirely, quality speaks quietly, old money not new money",
  "chaos-raw":          "unfiltered, relatable, internet-native — conversational, real talk, typo-energy without the typos, 'I said what I said', Gen Z authentic",
  "quote-focus-style":  "minimal, poetic, impactful — one powerful idea per post, almost no extra words, every syllable intentional, resonance over volume",
};

function extractSlideText(data: DesignData): string {
  return (data.elements as DesignElement[])
    .filter((el) => el.type === "text" && el.content)
    .map((el) => el.content ?? "")
    .join(" · ");
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiRl = await checkApiRateLimit(userId);
  if (apiRl) return apiRl;
  const aiRl = checkAiRateLimit(userId);
  if (aiRl) return aiRl;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 503 });

  // Load bundle + slides
  const [bundle] = await db
    .select()
    .from(contentBundlesTable)
    .where(and(eq(contentBundlesTable.id, params.id), eq(contentBundlesTable.userId, userId), isNull(contentBundlesTable.deletedAt)));
  if (!bundle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const slides = await db
    .select()
    .from(designsTable)
    .where(and(eq(designsTable.bundleId, params.id), eq(designsTable.userId, userId), isNull(designsTable.deletedAt)))
    .orderBy(asc(designsTable.slideIndex));

  // Build slide summary for the prompt
  const slideSummary = slides
    .slice(0, 20)
    .map((s, i) => {
      const text = extractSlideText(s.data as DesignData);
      return `Slide ${i + 1} (${s.title}): ${text || "(visual only)"}`;
    })
    .join("\n");

  const style = bundle.style ?? "minimal-luxury";
  const tone = TONE_GUIDE[style] ?? TONE_GUIDE["minimal-luxury"];

  const systemPrompt = `You are a social media content strategist who writes platform-native copy for creators and brands.
Tone: ${tone}
Visual style: ${style.replace(/-/g, " ")}

You will receive a summary of carousel slides and must generate a complete social media content package.

Return ONLY valid JSON matching this exact shape — no extra keys, no markdown:
{
  "mainCaption": {
    "tiktok": "<TikTok caption, 80-150 words, hook first, conversational, ends with CTA>",
    "instagram": "<Instagram caption, 120-200 words, hook + value + CTA, line-break friendly>"
  },
  "hooks": [
    "<hook 1 — 6-12 words, scroll-stopping>",
    "<hook 2>",
    "<hook 3>",
    "<hook 4>",
    "<hook 5>"
  ],
  "ctaSuggestions": [
    "<CTA 1 — action-oriented, 3-6 words>",
    "<CTA 2>",
    "<CTA 3>",
    "<CTA 4>",
    "<CTA 5>",
    "<CTA 6>"
  ],
  "hashtagSets": {
    "broad": ["<10 broad hashtags with # prefix>"],
    "niche": ["<10 niche hashtags with # prefix>"],
    "lowCompetition": ["<10 low-competition hashtags with # prefix, under 500k posts>"]
  },
  "platformVariants": {
    "tiktok": "<TikTok-optimized copy, 50-80 words, trend-aware, call to stitch/duet optional>",
    "instagram": "<Instagram-optimized, 80-120 words, storytelling hook>",
    "threads": "<Threads-optimized, 150-280 chars, punchy and direct>",
    "twitter": "<X/Twitter, under 240 chars, punchy, no hashtags in body>"
  }
}`;

  const userPrompt = `Bundle title: "${bundle.title}"
Style: ${style}

Carousel slides:\n${slideSummary}`;

  try {
    const response = await fetchOpenAIWithRetry("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: "AI request failed", details: err }, { status: 502 });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return NextResponse.json({ error: "No AI response" }, { status: 502 });

    let parsed: Omit<ContentAssets, "generatedAt" | "topic">;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json({ error: "Invalid AI response format" }, { status: 502 });
    }

    // Strip markdown bold/italic markers the model sometimes leaks into plain-text fields
    const stripMd = (s: string) => s.replace(/\*\*/g, "").replace(/\*/g, "").trim();
    const stripArr = (arr: string[]) => Array.isArray(arr) ? arr.map(stripMd) : arr;

    const assets: ContentAssets = {
      ...parsed,
      mainCaption: {
        tiktok: stripMd(parsed.mainCaption?.tiktok ?? ""),
        instagram: stripMd(parsed.mainCaption?.instagram ?? ""),
      },
      hooks: stripArr(parsed.hooks),
      ctaSuggestions: stripArr(parsed.ctaSuggestions),
      platformVariants: {
        tiktok: stripMd(parsed.platformVariants?.tiktok ?? ""),
        instagram: stripMd(parsed.platformVariants?.instagram ?? ""),
        threads: stripMd(parsed.platformVariants?.threads ?? ""),
        twitter: stripMd(parsed.platformVariants?.twitter ?? ""),
      },
      generatedAt: new Date().toISOString(),
      topic: bundle.title,
    };

    // Persist to bundle
    await db
      .update(contentBundlesTable)
      .set({ assets, updatedAt: new Date() })
      .where(and(eq(contentBundlesTable.id, params.id), eq(contentBundlesTable.userId, userId)));

    return NextResponse.json({ assets });
  } catch (e) {
    console.error("[generate-assets]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
