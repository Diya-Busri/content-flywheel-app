import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export type VideoNicheItem = {
  id: string;
  name: string;
  saturation: "low" | "medium" | "high";
  estimated_monthly_views: string;
  trend: "rising" | "stable";
  angles: string[];
  why_it_works: string;
};

type OpenAINiche = {
  name?: string;
  saturation?: string;
  estimated_monthly_views?: string;
  trend?: string;
  angles?: string[];
  why_it_works?: string;
};

function normalizeSaturation(s: string | undefined): "low" | "medium" | "high" {
  if (!s || typeof s !== "string") return "medium";
  const lower = s.trim().toLowerCase();
  if (lower === "low") return "low";
  if (lower === "high") return "high";
  return "medium";
}

function normalizeTrend(s: string | undefined): "rising" | "stable" {
  if (!s || typeof s !== "string") return "rising";
  const lower = s.trim().toLowerCase();
  if (lower === "stable") return "stable";
  return "rising";
}

function mapToNiche(raw: OpenAINiche, index: number): VideoNicheItem {
  return {
    id: `niche-${Date.now()}-${index}`,
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : "Video niche",
    saturation: normalizeSaturation(raw.saturation),
    estimated_monthly_views: typeof raw.estimated_monthly_views === "string" ? raw.estimated_monthly_views : "~500k",
    trend: normalizeTrend(raw.trend),
    angles: Array.isArray(raw.angles) ? raw.angles.filter((a): a is string => typeof a === "string").slice(0, 3) : [],
    why_it_works: typeof raw.why_it_works === "string" && raw.why_it_works.trim() ? raw.why_it_works.trim() : "",
  };
}

/**
 * POST: Generate 6 YouTube niche ideas from topics and content_style.
 * Body: { topics: string, content_style?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const apiRl = await checkApiRateLimit(userId);

    if (apiRl) return apiRl;

    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const topics = typeof body.topics === "string" ? body.topics.trim() : "";
    const contentStyleRaw =
      typeof body.content_style === "string"
        ? body.content_style.trim().toLowerCase()
        : typeof body.contentStyle === "string"
          ? body.contentStyle.trim().toLowerCase()
          : "";
    const contentStyle =
      contentStyleRaw === "faceless" || contentStyleRaw === "personal-brand" || contentStyleRaw === "ai-generated"
        ? contentStyleRaw
        : "";

    const styleInstructions =
      contentStyle === "faceless"
        ? "If content_style is 'faceless': prioritize niches that work well with stock footage, animations, screen recordings, voiceovers."
        : contentStyle === "ai-generated"
          ? "If content_style is 'ai-generated': prioritize niches that work exceptionally well with AI avatars and automated video generation (news, facts, tutorials, storytime, motivation)."
          : contentStyle === "personal-brand"
            ? "If content_style is 'personal-brand': prioritize niches that benefit from on-camera presence, personality-driven content, trust-building."
            : "";

    const prompt = `Generate 6 YouTube niche ideas for ${contentStyle ? contentStyle + " " : ""}content creators based on: ${topics || "general content creation"}.

${styleInstructions}

Return JSON array with: name, saturation, estimated_monthly_views, trend, angles, why_it_works.

Return ONLY a JSON array, no markdown, no explanation:
[{
  "name": "Niche name",
  "saturation": "low" | "medium" | "high",
  "estimated_monthly_views": "~500k",
  "trend": "rising" | "stable",
  "angles": ["angle 1", "angle 2", "angle 3"],
  "why_it_works": "One sentence on why this niche works."
}]`;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key is not configured" },
        { status: 503 }
      );
    }

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
              content: "You are a video content strategy expert. Return only valid JSON arrays, no markdown.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.8,
          max_tokens: 2000,
        }),
      },
      { onRetry: (attempt, delayMs) => console.log(`[generate-niches] Retry ${attempt} in ${delayMs}ms`) }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("[generate-niches] OpenAI error:", response.status, errText);
      return NextResponse.json(
        { error: "Failed to generate niches. Please try again." },
        { status: 502 }
      );
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content ?? "";
    let jsonText = content.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    }
    const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
    const raw: OpenAINiche[] = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    const niches = raw.slice(0, 6).map(mapToNiche);

    return NextResponse.json(niches);
  } catch (err) {
    console.error("[generate-niches]", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to generate niches",
      },
      { status: 500 }
    );
  }
}
