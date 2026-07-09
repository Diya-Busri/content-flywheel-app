/**
 * POST /api/launch/discover
 * ─────────────────────────────────────────────────────────────────────────────
 * Accepts the user's 5-step profile answers and returns 4 tailored digital
 * product opportunities via GPT-4o.
 *
 * Body: { interests, audience, experience, productType, goal }
 * Returns: { opportunities: Opportunity[] }
 */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";

export interface Opportunity {
  id:          string;
  name:        string;
  tagline:     string;
  whyFits:     string;
  demand:      number;   // 1-10
  competition: number;   // 1-10
  difficulty:  "Easy" | "Medium" | "Hard";
  priceRange:  string;
  confidence:  number;   // 1-10
  launchGoal:  string;   // pre-filled goal for the launch pipeline
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkApiRateLimit(userId);
  if (rl) return rl;

  const body = await request.json().catch(() => ({})) as Record<string, string>;
  const { interests, audience, experience, productType, goal } = body;

  if (!interests || !audience) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const prompt = `You are an expert AI business advisor helping someone discover the perfect digital product to create and sell online.

User profile:
- Interests / passions: ${interests}
- Audience they want to help: ${audience}
- Their experience / background: ${experience || "Not specified"}
- Product type preference: ${productType || "Open to suggestions"}
- Main goal: ${goal || "Not specified"}

Generate exactly 4 tailored digital product opportunities. Be specific and realistic — avoid generic ideas. Each idea must be meaningfully different from the others.

Return ONLY valid JSON with no markdown fences:
{
  "opportunities": [
    {
      "id": "unique-kebab-slug",
      "name": "Specific Product Name",
      "tagline": "One compelling sentence describing what it does",
      "whyFits": "2-3 sentences explaining specifically why this fits their interests, audience, and experience",
      "demand": 8,
      "competition": 5,
      "difficulty": "Easy",
      "priceRange": "£19–39",
      "confidence": 8,
      "launchGoal": "I want to build a [specific product] for [specific audience] that helps them [specific outcome]"
    }
  ]
}

Rules:
- demand, competition, confidence: integers 1-10
- difficulty: exactly "Easy", "Medium", or "Hard"
- First opportunity = strongest match for their profile (the "best fit")
- launchGoal: specific, detailed, 1-sentence goal for an AI product generator (under 200 chars)
- priceRange: realistic digital product price in GBP (£9–£197 range)
- Focus on: ebooks, templates, courses, prompt packs, notion systems, spreadsheets, guides, toolkits
- If productType is "I don't know", choose the format that best suits their profile
- whyFits must reference their specific interests/experience, not be generic`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2500,
        temperature: 0.75,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[launch/discover] OpenAI error:", errText);
      throw new Error("OpenAI error");
    }

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text  = data.choices?.[0]?.message?.content?.trim() ?? "{}";
    const parsed = JSON.parse(text) as { opportunities?: Opportunity[] };

    return NextResponse.json({ opportunities: parsed.opportunities ?? [] });
  } catch (err) {
    console.error("[launch/discover]", err);
    return NextResponse.json({ error: "Failed to generate ideas" }, { status: 500 });
  }
}
