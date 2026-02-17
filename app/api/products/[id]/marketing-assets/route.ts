import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";
import type { MarketingAssets } from "@/db/schema/products-schema";

type Section = { id: string; title: string; content?: string };

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

    const body = await request.json().catch(() => ({}));
    const regenerateDescription = body.regenerateDescription === true;
    const existing = (product.marketingAssets ?? {}) as MarketingAssets;

    const title = (product.title ?? "").trim() || "Digital Product";
    const niche = (product.niche ?? "").trim() || "general";
    const format = (product.format ?? "").trim() || "PDF";
    const sections = (product.content as { sections?: Section[] })?.sections ?? [];
    const sectionTitles = sections.map((s) => s.title).filter(Boolean);
    const sectionList = sectionTitles.length ? sectionTitles.join(", ") : "Multiple sections";
    const firstContent = sections[0]?.content?.slice(0, 400) ?? "";

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 503 }
      );
    }

    const prompt = `You are an expert at writing marketplace listings for digital products (Etsy, Gumroad, Stan Store, Payhip). Generate marketing copy for this product.

PRODUCT:
- Title: "${title}"
- Niche: ${niche}
- Format: ${format}
- Sections/chapters: ${sectionList}
${firstContent ? `- First section content (excerpt):\n${firstContent}` : ""}

Return ONLY valid JSON (no markdown, no code fences) with this exact structure:

{
  "productTitle": "Marketplace-optimized title (include product name + format + key benefit + 'Digital Download' + 'Printable PDF'. Example: 'Passive Income Workbook | Digital Download | Financial Freedom Guide | Printable PDF'. Max ~100 chars.)",
  "productDescription": "Full listing description with these parts, each separated by a blank line:\n1. Hook/opening line (1-2 sentences that grab attention)\n2. What's included: list the chapters/sections\n3. Who it's for (target audience)\n4. Benefits (3-5 bullets)\n5. What they'll learn (3-5 bullets)\n6. File format and page count (e.g. PDF, instant download)\n7. Short disclaimer (e.g. digital product, no physical shipment). Use clear paragraphs and bullet points.",
  "hashtags": ["tag1", "tag2", ...],
  "seoKeywords": ["long tail keyword one", "long tail keyword two", ...]
}

Rules:
- hashtags: 13-15 relevant tags for marketplace SEO (e.g. passiveincome, digitalplanner, workbook, printable). Include niche and format. No spaces; use camelCase or single words. Return without # prefix; the app will display them as chips.
- seoKeywords: 10-15 long-tail search phrases buyers might use (e.g. "printable budget planner PDF", "digital wedding planner Etsy").
- productDescription: professional, scannable, benefit-focused. Include the section list.`;

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
              "You generate marketplace listing copy for digital products. Return only valid JSON matching the exact structure requested. No markdown, no code fences.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenAI marketing-assets error:", err);
      return NextResponse.json(
        { error: "Failed to generate marketing assets" },
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
      productTitle?: string;
      productDescription?: string;
      hashtags?: string[];
      seoKeywords?: string[];
    };

    const assets: MarketingAssets = {
      ...existing,
      productTitle:
        typeof parsed.productTitle === "string" ? parsed.productTitle : existing.productTitle ?? title,
      productDescription:
        regenerateDescription || typeof parsed.productDescription === "string"
          ? (parsed.productDescription ?? existing.productDescription ?? "")
          : existing.productDescription,
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : existing.hashtags ?? [],
      seoKeywords: Array.isArray(parsed.seoKeywords) ? parsed.seoKeywords : existing.seoKeywords ?? [],
      updatedAt: new Date().toISOString(),
    };

    await db
      .update(productsTable)
      .set({
        marketingAssets: assets,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(productsTable.id, productId),
          eq(productsTable.userId, userId),
          isNull(productsTable.deletedAt)
        )
      );

    return NextResponse.json(assets);
  } catch (err) {
    console.error("Marketing assets generation failed:", err);
    return NextResponse.json(
      {
        error: "Failed to generate marketing assets",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
