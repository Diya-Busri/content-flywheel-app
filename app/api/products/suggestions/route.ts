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
      ? `Sub-niche angles to work from: ${nicheSubNiches.slice(0, 5).join(", ")}.`
      : "";
    const excludeStr = exclude.length ? `Already suggested (do NOT repeat these): ${exclude.join(", ")}.` : "";

    const prompt = `Generate exactly 6 specific, sellable digital product ideas for the niche: "${nicheName}"

${subNichesStr}
${excludeStr}

Think about this buyer's actual life situation:
- What format do they prefer to consume? (busy nurse = quick-reference PDF; student = structured workbook; freelancer = Notion dashboard)
- What is the specific trigger moment that makes them pull out their card for a $17-67 digital product?
- What title would they actually type into Etsy or Gumroad search?

Rules for every product:
1. TITLE must be specific and searchable — not "Budget Tracker" but "Freelance Tax Expense Tracker for UK Self-Employed"
2. INCLUDED must list concrete deliverables (e.g. "12-week meal grid, 3 shopping list templates, macro reference sheet, 'what to prep first' quick-start guide") — not vague descriptions
3. WHY must explain: the specific trigger moment that makes someone buy, and how content about this product drives traffic (e.g. "Nurses Google 'meal prep for shift work' constantly. A 60-second 'pack my bag with me' video leads directly to the sale.")
4. PRICE NOTE must explain the psychology, not just the format (e.g. "Impulse-buy range for healthcare workers who've wasted money on apps that didn't fit shift work")
5. Include at least one product under $20 (accessible entry point) and one $47+ (premium/comprehensive)

VARIETY: Use different formats (PDF, Notion Template, Workbook, Checklist Pack, Spreadsheet, Mini-Course, Planner). Different price points. Different durations/structures.

Do NOT invent statistics. Reason from buyer psychology and real product patterns.

${PRICING_RULES}

Return ONLY a valid JSON array of exactly 6 objects (no markdown, no code fences):
[{
  "name": "Specific, searchable product title",
  "type": "Notion Template | PDF + Guide | Spreadsheet Template | Workbook | Mini-Course | Checklist Pack | Planner",
  "price": "$X-Y",
  "priceNote": "Psychology behind this price for this specific buyer",
  "included": "Concrete bullet-style list of what is inside (e.g. '10-week habit grid, 3 reflection worksheets, weekly reset prompt page, printable habit stickers')",
  "why": "2 sentences: the specific trigger moment that makes someone buy, and the content angle that drives discovery for this product",
  "complexity": "Beginner-friendly" | "Intermediate" | "Advanced",
  "estimatedTime": "~X hours to customize"
}]`;

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
              "You are a digital product strategist who has studied what actually converts on Gumroad, Etsy, TikTok Shop, and Payhip. You understand buyer psychology at the scroll-to-checkout level. You write product titles buyers would search for, concrete 'what's included' descriptions, and 'why it sells' explanations grounded in real purchase triggers — not generic statements. You never invent statistics or percentages. Return only a valid JSON array, no markdown, no code fences.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.75,
        max_tokens: 3000,
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
