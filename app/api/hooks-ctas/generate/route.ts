export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { cleanProductTitle } from "@/lib/product-title";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const apiRl = await checkApiRateLimit(userId);

    if (apiRl) return apiRl;

    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const rawTitle = typeof body.productTitle === "string" ? body.productTitle.trim() : "";
    const productTitle = cleanProductTitle(rawTitle) || rawTitle;
    const productType = typeof body.productType === "string" ? body.productType : "";
    const productIncluded = typeof body.productIncluded === "string" ? body.productIncluded : "";
    const productWhy = typeof body.productWhy === "string" ? body.productWhy : "";
    const productPrice = typeof body.productPrice === "string" ? body.productPrice : "";
    const nicheName = typeof body.nicheName === "string" ? body.nicheName : "";

    if (!productTitle) {
      return NextResponse.json(
        { error: "Missing product title" },
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

    const context = [
      `Product: "${productTitle}"`,
      productType ? `Type: ${productType}` : "",
      productPrice ? `Price: ${productPrice}` : "",
      productIncluded ? `What's included: ${productIncluded}` : "",
      productWhy ? `Why it sells: ${productWhy}` : "",
      nicheName ? `Niche/audience: ${nicheName}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const prompt = `Generate video HOOKS and CTAs for this specific digital product. Write them like a real founder talking to someone who actually needs this — not like a marketing agency.

PRODUCT CONTEXT:
${context}

RULES FOR HOOKS (generate 5-6):
- Start with the problem, frustration, or uncomfortable truth — not the product.
- Be specific to what this product actually solves. Reference the format, outcome, or exact pain point.
- Write in first or second person. Direct. Slightly blunt. Honest.
- Do NOT start with: "Are you tired of...", "Have you ever...", "Introducing...", "The #1...", "This changed everything".
- Do NOT use generic openers. Every hook should feel like it was written for THIS product only.
- Aim for this energy: "Most people who buy budgeting templates don't fail because they're lazy. They fail because the template doesn't match how they actually think about money."

RULES FOR CTAs (generate 5-6):
- Write like a soft, confident invitation — not a command.
- Be specific to the product action: what will they do when they click/buy? Reference that directly.
- Include at least one very soft CTA (e.g. "Save this for when you're ready to actually start").
- Never use: "Link in bio", "Comment [word] and I'll send it", "Download now", "Get yours today", "Don't miss out".
- Aim for this energy: "If you want the actual system, it's linked in bio." / "This is what I wish I had when I started — link in bio."

BANNED words/phrases (never use in hooks or CTAs):
"unlock", "supercharge", "boost", "transform", "skyrocket", "game-changing", "never-ending", "valuable", "amazing", "incredible", "revolutionary"

Return ONLY valid JSON (no markdown):
{
  "hooks": ["hook 1", "hook 2", "hook 3", "hook 4", "hook 5"],
  "ctas": ["cta 1", "cta 2", "cta 3", "cta 4", "cta 5"]
}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        // gpt-4o-mini: hooks and CTAs, non-critical
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You write video hooks and CTAs for digital products. Your style is direct, honest, and founder-led — never salesy or generic. You write like a real person who built something because they needed it, talking to someone who needs it too. Return only valid JSON with keys 'hooks' and 'ctas', each an array of strings.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenAI hooks-ctas error:", err);
      return NextResponse.json(
        { error: "Failed to generate hooks and CTAs" },
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
    const parsed = JSON.parse(jsonText) as { hooks?: string[]; ctas?: string[] };
    const hooks = Array.isArray(parsed.hooks) ? parsed.hooks.slice(0, 6) : [];
    const ctas = Array.isArray(parsed.ctas) ? parsed.ctas.slice(0, 6) : [];

    return NextResponse.json({ hooks, ctas });
  } catch (err) {
    console.error("Hooks/CTAs generation error:", err);
    return NextResponse.json(
      {
        error: "Failed to generate hooks and CTAs",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
