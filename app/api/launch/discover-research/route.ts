/**
 * POST /api/launch/discover-research
 * ─────────────────────────────────────────────────────────────────────────────
 * Quick viability check for a chosen discovery opportunity.
 * Uses GPT-4o-mini (fast, cheap) to produce a focused validation report
 * that feeds into the Founder Decision step.
 *
 * Body: { name, tagline, launchGoal, answersContext }
 * Returns: QuickResearch
 */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";

export interface QuickResearch {
  validationScore: number;                                         // 1-10
  findings:        string[];                                       // exactly 5 bullet points
  opportunity:     string;                                         // 2-3 sentence market summary
  risk:            string;                                         // single main risk
  recommendation:  "Build it" | "Refine first" | "Proceed with caution";
  refinedGoal:     string;                                         // improved launch goal
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkApiRateLimit(userId);
  if (rl) return rl;

  const body = await request.json().catch(() => ({})) as Record<string, string>;
  const { name, tagline, launchGoal, answersContext } = body;

  if (!name || !launchGoal) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const prompt = `You are a market research analyst conducting a rapid viability check for a digital product idea.

Product idea: ${name}
Description: ${tagline}
Target goal: ${launchGoal}
Creator profile: ${answersContext ?? "Not provided"}

Conduct a quick viability analysis covering: market demand, competition level, target audience fit, pricing realism, and creator-market fit.

Return ONLY valid JSON (no markdown):
{
  "validationScore": 7,
  "findings": [
    "Strong and growing demand in this niche over the past 12 months",
    "Limited quality competition in the specific sub-niche",
    "Target audience actively searches for this type of solution",
    "Creator's background gives them genuine credibility to produce this",
    "Price point is realistic and competitive for this product category"
  ],
  "opportunity": "2-3 sentences describing the market opportunity and why this could do well.",
  "risk": "The single most important risk or challenge to be aware of.",
  "recommendation": "Build it",
  "refinedGoal": "Refined version of the launch goal with better, more specific positioning (under 200 chars)"
}

Rules:
- validationScore: integer 1-10 (7+ = strong viability)
- findings: exactly 5 specific, insightful observations
- recommendation: exactly one of "Build it", "Refine first", "Proceed with caution"
- refinedGoal: more specific and compelling than the original, keep it concise
- Be honest — don't inflate scores for weak ideas`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 900,
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      console.error("[discover-research] OpenAI error:", await res.text());
      throw new Error("OpenAI error");
    }

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text  = data.choices?.[0]?.message?.content?.trim() ?? "{}";
    const parsed = JSON.parse(text) as QuickResearch;

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[discover-research]", err);
    return NextResponse.json({ error: "Research failed" }, { status: 500 });
  }
}
