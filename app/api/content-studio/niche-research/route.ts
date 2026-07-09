import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";

export const dynamic = "force-dynamic";

export type SampleChannel = {
  name: string;
  platform: string;
  metric: string; // e.g. "2.1M subscribers", "500K followers"
};

export type NicheRecommendation = {
  id: string;
  name: string;
  profitabilityScore: number; // 0-100
  competition: string; // Low | Medium | High
  opportunity: string; // 1-2 sentence
  sampleChannels: SampleChannel[];
  growthPotential: string;
  contentPillars: string[];
};

type OpenAINiche = {
  name?: string;
  profitabilityScore?: number;
  competition?: string;
  opportunity?: string;
  sampleChannels?: Array<{ name?: string; platform?: string; metric?: string }>;
  growthPotential?: string;
  contentPillars?: string[];
};

function mapToNiche(raw: OpenAINiche, index: number): NicheRecommendation {
  const score = typeof raw.profitabilityScore === "number" && raw.profitabilityScore >= 0 && raw.profitabilityScore <= 100
    ? raw.profitabilityScore
    : 70;
  return {
    id: `niche-${Date.now()}-${index}`,
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : "Content niche",
    profitabilityScore: score,
    competition: ["Low", "Medium", "High"].includes(String(raw.competition)) ? String(raw.competition) : "Medium",
    opportunity: typeof raw.opportunity === "string" && raw.opportunity.trim() ? raw.opportunity.trim() : "",
    sampleChannels: Array.isArray(raw.sampleChannels)
      ? raw.sampleChannels
          .filter((c) => c && (c.name || c.platform))
          .map((c) => ({
            name: String(c.name ?? "Channel").trim(),
            platform: String(c.platform ?? "YouTube").trim(),
            metric: String(c.metric ?? "").trim() || "—",
          }))
          .slice(0, 5)
      : [],
    growthPotential: typeof raw.growthPotential === "string" && raw.growthPotential.trim()
      ? raw.growthPotential.trim()
      : "Strong demand; room for new creators.",
    contentPillars: Array.isArray(raw.contentPillars)
      ? raw.contentPillars.filter((p): p is string => typeof p === "string" && p.trim().length > 0).slice(0, 6)
      : [],
  };
}

/**
 * POST: Generate 5-10 niche recommendations for content creation.
 * Body: { interests: string, skills?: string, currentAudience?: string }
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
    const interests = typeof body.interests === "string" ? body.interests.trim() : "";
    const skills = typeof body.skills === "string" ? body.skills.trim() : "";
    const currentAudience = typeof body.currentAudience === "string" ? body.currentAudience.trim() : "";

    if (!interests) {
      return NextResponse.json(
        { error: "Interests are required. Describe what you're interested in or passionate about." },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI is not configured. Add OPENAI_API_KEY to your environment." },
        { status: 503 }
      );
    }

    const prompt = `You are a content strategy expert. Generate 5-10 niche recommendations for a creator who wants to make video content (TikTok, YouTube Shorts, Instagram Reels).

USER INPUT:
- Interests: ${interests}
${skills ? `- Skills/experience: ${skills}` : ""}
${currentAudience ? `- Current audience (if any): ${currentAudience}` : ""}

For EACH niche provide:
1. name: Short, clear niche name (e.g. "Personal Finance for Gen Z")
2. profitabilityScore: 0-100 (consider competition vs opportunity; 70+ = good balance)
3. competition: "Low" | "Medium" | "High"
4. opportunity: 1-2 sentences on why this niche has room and monetization potential
5. sampleChannels: 3-5 real or realistic example channels that succeed in this niche, with name, platform (TikTok/YouTube/Instagram), and metric (e.g. "2.1M subscribers", "500K followers")
6. growthPotential: 1-2 sentences on growth outlook (trending, evergreen, seasonal, etc.)
7. contentPillars: 4-6 content pillars (recurring themes) for this niche, e.g. ["How-to tutorials", "Behind the scenes", "Trending takes", "Q&A"]

Return ONLY a valid JSON array. No markdown, no code fence. Example shape:
[{"name":"...","profitabilityScore":78,"competition":"Medium","opportunity":"...","sampleChannels":[{"name":"...","platform":"YouTube","metric":"..."}],"growthPotential":"...","contentPillars":["..."]}]`;

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
              content: "You are a content strategy expert. Always return a valid JSON array only. No markdown, no explanation.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        }),
      },
      {
        onRetry: (attempt, delayMs) =>
          console.log(`[niche-research] Retry ${attempt} in ${delayMs / 1000}s`),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 429) {
        return NextResponse.json(
          { error: "High demand. Please wait a moment and try again." },
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
    const match = jsonText.match(/\[[\s\S]*\]/);
    const rawNiches: OpenAINiche[] = match ? JSON.parse(match[0]) : [];
    const niches: NicheRecommendation[] = rawNiches.slice(0, 10).map(mapToNiche);

    return NextResponse.json({ niches });
  } catch (err) {
    console.error("[content-studio/niche-research]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate recommendations" },
      { status: 500 }
    );
  }
}
