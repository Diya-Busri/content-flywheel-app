import { NextRequest, NextResponse } from "next/server";

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
    const body = await request.json().catch(() => ({}));
    const interests = typeof body.interests === "string" ? body.interests : "";
    const goal = typeof body.goal === "string" ? body.goal : "";
    const exclude: string[] = Array.isArray(body.exclude) ? body.exclude.filter((x: unknown) => typeof x === "string") : [];
    const showTrending = Boolean(body.showTrending);

    console.log("🎯 NICHE GENERATION REQUEST:", { interests, goal, showTrending });

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

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
              "You are a digital product niche expert. Always return valid JSON arrays only, no markdown formatting.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.8,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("❌ OpenAI Error:", error);
      return NextResponse.json(
        { error: "OpenAI API failed", details: error },
        { status: 502 }
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

    const niches: NicheOption[] = rawNiches.slice(0, 6).map(mapToNicheOption);

    console.log("✅ Parsed niches:", niches.map((n) => n.name));

    if (!showTrending && interests.trim().length > 0) {
      const interestKeywords = interests
        .toLowerCase()
        .split(/[,\s]+/)
        .map((w) => w.trim())
        .filter((w) => w.length > 3);

      const validatedNiches = niches.filter((niche) => {
        const nicheText = `${niche.name} ${niche.why}`.toLowerCase();
        const hasMatch = interestKeywords.some((keyword) => nicheText.includes(keyword));

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
