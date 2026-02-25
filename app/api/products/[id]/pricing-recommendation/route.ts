import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";

type Section = { id: string; title: string; content?: string };

/**
 * POST /api/products/[id]/pricing-recommendation
 * Returns AI pricing recommendation: priceRange, strategy (one-time vs tiered), reasoning (one sentence).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id: productId } = await params;
    if (!productId) {
      return NextResponse.json({ error: "Product ID required" }, { status: 400 });
    }

    const [product] = await db
      .select()
      .from(productsTable)
      .where(
        and(
          eq(productsTable.id, productId),
          eq(productsTable.userId, userId),
          isNull(productsTable.deletedAt)
        )
      );
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const title = (product.title ?? "").trim() || "Digital Product";
    const niche = (product.niche ?? "").trim() || "general";
    const format = (product.format ?? "").trim() || "PDF";
    const marketingAssets = product.marketingAssets as { productDescription?: string } | null;
    const description = marketingAssets?.productDescription ?? (product.description ?? "").trim().slice(0, 500);
    const sections = (product.content as { sections?: Section[] })?.sections ?? [];
    const sectionList = sections.map((s) => s.title).filter(Boolean).join(", ") || "Multiple sections";

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 503 }
      );
    }

    const prompt = `You are an expert at pricing digital products (ebooks, planners, templates, courses) for marketplaces like Etsy, Gumroad, Stan Store.

PRODUCT:
- Title: "${title}"
- Niche: ${niche}
- Format: ${format}
- Sections: ${sectionList}
${description ? `- Description (excerpt): ${description}` : ""}

Return ONLY valid JSON (no markdown, no code fences) with this exact structure:
{
  "priceRange": "A short price range e.g. \\"$17–27\\" or \\"$37–47\\"",
  "strategy": "Either \\"One-time purchase\\" or \\"Tiered pricing\\" (e.g. basic / premium bundles)",
  "reasoning": "Exactly one sentence explaining why this price and strategy fit this product and audience."
}`;

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
              "You give pricing recommendations for digital products. Return only valid JSON with priceRange, strategy, and reasoning. No markdown.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.6,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[pricing-recommendation] OpenAI error:", response.status, errText);
      return NextResponse.json(
        { error: "Failed to get pricing recommendation" },
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
    const parsed = JSON.parse(jsonText) as {
      priceRange?: string;
      strategy?: string;
      reasoning?: string;
    };

    const priceRange = typeof parsed.priceRange === "string" ? parsed.priceRange : "$17–47";
    const strategy = typeof parsed.strategy === "string" ? parsed.strategy : "One-time purchase";
    const reasoning = typeof parsed.reasoning === "string" ? parsed.reasoning : "This price fits the format and typical buyer expectations for this niche.";

    return NextResponse.json({ priceRange, strategy, reasoning });
  } catch (err) {
    console.error("[pricing-recommendation]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to get pricing recommendation" },
      { status: 500 }
    );
  }
}
