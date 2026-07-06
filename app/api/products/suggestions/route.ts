export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";

export type ProductSuggestion = {
  id: string;
  name: string;
  type: string;
  price: string;
  priceNote: string;
  included: string;
  why: string;
  complexity?: "Beginner-friendly" | "Intermediate" | "Advanced";
  estimatedTime?: string;
};

const PRICING_RULES = `
TIME-BASED PRICING (use when product has a clear duration):
- 7-day products: $7-12
- 14-day products: $12-17
- 30-day products: $17-27
- 60-day products: $27-47
- 90-day products: $37-67
- 6-month products: $47-97
- 12-month products: $67-127

NON-TIME-BASED PRICING (use when no duration):
- Simple checklist: $7-12
- Template/tracker: $12-27
- Simple PDF/ebook guide: $17-27
- Comprehensive workbook (10+ chapters, exercises, worksheets, action items): $37-67
- Complete course/system: $37-97

EXAMPLES:
- "90-Day Baby Savings Challenge" → price "$37-47", priceNote "Based on 90-day duration"
- "7-Day Fitness Reset" → price "$7-12", priceNote "Based on 7-day program"
- "Budget Tracker Spreadsheet" → price "$17-27", priceNote "Based on template/tracker format"
- "Real Estate Investment Workbook" (interactive, 10 chapters, worksheets) → price "$47-67", priceNote "Comprehensive workbook with exercises and templates"
- "Complete Marketing System" → price "$37-97", priceNote "Based on complete course/system"
`;

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const apiRl = await checkApiRateLimit(userId);

    if (apiRl) return apiRl;

    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const nicheName = typeof body.niche === "string" ? body.niche.trim() : "";
    const nicheSubNiches = Array.isArray(body.subNiches) ? body.subNiches : [];
    const exclude: string[] = Array.isArray(body.exclude) ? body.exclude.filter((x: unknown) => typeof x === "string") : [];

    if (!nicheName) {
      return NextResponse.json(
        { error: "Missing niche name" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 503 }
      );
    }

    const subNichesStr = nicheSubNiches.length
      ? `Some sub-niche angles to consider: ${nicheSubNiches.slice(0, 5).join(", ")}.`
      : "";
    const excludeStr = exclude.length ? `Do NOT suggest any of these (already shown): ${exclude.join(", ")}.` : "";

    const prompt = `Generate exactly 6 digital product ideas for this niche: "${nicheName}"
${subNichesStr}
${excludeStr}

VARIETY: Mix different formats (Notion Template, PDF/Guide, Spreadsheet, Workbook, Mini-Course, Checklist). Mix price points (e.g. $12, $27, $47, $67). Mix durations (7-day, 30-day, 90-day, evergreen).

${PRICING_RULES}

For EACH product:
1. "price" using the rules above (e.g. "$37-47" or "$17-27").
2. "priceNote" e.g. "Based on 90-day duration" or "Based on template/tracker format".
3. "complexity": one of "Beginner-friendly" | "Intermediate" | "Advanced".
4. "estimatedTime": e.g. "~2 hours to customize" or "~1 hour to customize" or "~4 hours to customize".

Return ONLY a valid JSON array of exactly 6 objects (no markdown). Each object:
- "name": string (product title)
- "type": string (e.g. "Notion Template", "PDF + Guide", "Spreadsheet", "Mini-Course", "Workbook", "Checklist Pack")
- "price": string (e.g. "$37-47" or "$17-27")
- "priceNote": string
- "included": string (short description of what's included)
- "why": string (1 sentence why it sells)
- "complexity": "Beginner-friendly" | "Intermediate" | "Advanced"
- "estimatedTime": string (e.g. "~2 hours to customize")`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        // gpt-4o-mini: product suggestions (titles/descriptions), low complexity
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a digital product expert. Always return a valid JSON array only. No markdown, no code fences.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenAI products/suggestions error:", err);
      return NextResponse.json(
        { error: "Failed to generate suggestions" },
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
    const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
    const raw = jsonMatch ? (JSON.parse(jsonMatch[0]) as Array<Record<string, unknown>>) : [];

    const suggestions: ProductSuggestion[] = raw.slice(0, 6).map((item, i) => ({
      id: `sug-${Date.now()}-${i}`,
      name: typeof item.name === "string" ? item.name : "Digital product",
      type: typeof item.type === "string" ? item.type : "Digital product",
      price: typeof item.price === "string" ? item.price : "$17-27",
      priceNote: typeof item.priceNote === "string" ? item.priceNote : "Based on product format",
      included: typeof item.included === "string" ? item.included : "",
      why: typeof item.why === "string" ? item.why : "",
      complexity:
        item.complexity === "Beginner-friendly" || item.complexity === "Intermediate" || item.complexity === "Advanced"
          ? item.complexity
          : undefined,
      estimatedTime: typeof item.estimatedTime === "string" ? item.estimatedTime : undefined,
    }));

    return NextResponse.json(suggestions);
  } catch (err) {
    console.error("Product suggestions error:", err);
    return NextResponse.json(
      {
        error: "Failed to generate product suggestions",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
