import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";
import { cleanProductTitle } from "@/lib/product-title";
import { getBrandVoice } from "@/lib/brand-voice";

export const dynamic = "force-dynamic";

/**
 * POST /api/products/[id]/sales-page
 * Returns { html } — a self-contained HTML sales page for the product.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;
    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const { id: productId } = await params;
    if (!productId) return NextResponse.json({ error: "Product ID required" }, { status: 400 });

    const [product] = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId), isNull(productsTable.deletedAt)));

    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 503 });

    const rawTitle = (product.title ?? "").trim();
    const title = cleanProductTitle(rawTitle) || rawTitle || "Digital Product";
    const niche = (product.niche ?? "").trim() || "general";
    const format = (product.format ?? "").trim() || "PDF";
    const ma = (product.marketingAssets ?? {}) as Record<string, unknown>;
    const description = typeof ma.productDescription === "string" ? ma.productDescription.trim() : "";
    const productTitle = typeof ma.productTitle === "string" ? ma.productTitle.trim() : title;
    const mockupUrl = typeof ma.bookMockupUrl === "string" ? ma.bookMockupUrl : null;
    const thumbnailUrl = typeof ma.thumbnailUrl === "string" ? ma.thumbnailUrl : (typeof ma.coverThumbnailUrl === "string" ? ma.coverThumbnailUrl : null);
    const hashtags = Array.isArray(ma.hashtags) ? (ma.hashtags as string[]).slice(0, 5).map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ") : "";
    const seoKeywords = Array.isArray(ma.seoKeywords) ? (ma.seoKeywords as string[]).slice(0, 6).join(", ") : "";

    const brandVoice = await getBrandVoice(userId).catch(() => "");

    const heroImage = mockupUrl || thumbnailUrl;

    const userPrompt = `Generate a complete, self-contained HTML sales page for a digital product.

PRODUCT TITLE: ${productTitle}
NICHE: ${niche}
FORMAT: ${format}
DESCRIPTION: ${description || "A digital product for " + niche}
HERO IMAGE URL: ${heroImage || ""}
SEO KEYWORDS: ${seoKeywords}
HASHTAGS: ${hashtags}

Requirements:
- Self-contained HTML with embedded CSS (no external dependencies except Google Fonts)
- Mobile-responsive
- Sections: Hero with headline + CTA, Problem/Solution, What's Inside, Who It's For, CTA section
- Use #BUY_LINK as the placeholder for the purchase link
- Professional, conversion-optimised design
- Warm, modern colour scheme (use orange #FF6B35 as accent)
- Include a simple FAQ section (2-3 questions)
- If a hero image URL is provided, show it in the hero section; otherwise skip it
- Return ONLY the complete HTML document, no explanation`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: [
              "You are an expert web designer and copywriter. You create high-converting sales pages for digital products. Return only the complete HTML document — no markdown, no code fences, no explanation.",
              brandVoice ? `\n${brandVoice}` : "",
            ].join(""),
          },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.65,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[sales-page] OpenAI error:", response.status, errText);
      return NextResponse.json({ error: "Failed to generate sales page" }, { status: 502 });
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    let html = (data.choices?.[0]?.message?.content ?? "").trim();

    // Strip accidental code fences if model ignores instructions
    html = html.replace(/^```html\n?/i, "").replace(/^```\n?/, "").replace(/\n?```$/, "").trim();

    if (!html.toLowerCase().includes("<!doctype") && !html.toLowerCase().includes("<html")) {
      return NextResponse.json({ error: "Generated content is not valid HTML" }, { status: 502 });
    }

    return NextResponse.json({ html });
  } catch (err) {
    console.error("[sales-page]", err);
    return NextResponse.json({ error: "Failed to generate sales page" }, { status: 500 });
  }
}
