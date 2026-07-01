import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";
import type { MarketingAssets } from "@/db/schema/products-schema";
import { cleanProductTitle } from "@/lib/product-title";
import { getBrandVoice } from "@/lib/brand-voice";

type Section = { id: string; title: string; content?: string };

// PATCH — update individual marketing asset fields (e.g. comingSoon toggle)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [product] = await db
    .select({ marketingAssets: productsTable.marketingAssets })
    .from(productsTable)
    .where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId), isNull(productsTable.deletedAt)));

  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const allowedFields = [
    "comingSoon",
    "salePrice",
    "saleEndsAt",
    "thankYouMessage",
    "thankYouBonusUrl",
    "upsellProductId",
    "upsellDiscountPercent",
    "isCourseFormat",
    "freePreviewLessons",
    "payWhatYouWant",
    "minPrice",
    "sequenceId",
  ] as const;
  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) updates[field] = body[field];
  }

  const updatedAssets = { ...(product.marketingAssets as MarketingAssets ?? {}), ...updates };
  await db.update(productsTable).set({ marketingAssets: updatedAssets, updatedAt: new Date() }).where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId)));
  return NextResponse.json(updatedAssets);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params;
  console.log("[marketing-assets] POST request for productId:", productId ?? "(missing)");
  try {
    const { userId } = await auth();
    if (!userId) {
      console.warn("[marketing-assets] Unauthorized: no userId");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const apiRl = await checkApiRateLimit(userId);

    if (apiRl) return apiRl;

    const rl = checkAiRateLimit(userId);
    if (rl) return rl;
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

    const rawTitle = (product.title ?? "").trim();
    const title = cleanProductTitle(rawTitle) || rawTitle || "Digital Product";
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

    const brandVoice = await getBrandVoice(userId).catch(() => "");

    const prompt = `You are an expert at writing marketplace listings for digital products (Etsy, Gumroad, Stan Store, Payhip). Generate marketing copy for this product.
${brandVoice ? `\n${brandVoice}\nApply this brand voice to the productTitle and productDescription.\n` : ""}

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
      const errText = await response.text();
      console.error("[marketing-assets] OpenAI API error:", response.status, errText);
      return NextResponse.json(
        {
          error: "Failed to generate marketing assets",
          details: `OpenAI returned ${response.status}: ${errText.slice(0, 200)}`,
        },
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
    const message = err instanceof Error ? err.message : "Unknown error";
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[marketing-assets] Generation failed:", message, stack ?? err);
    return NextResponse.json(
      {
        error: "Failed to generate marketing assets",
        details: message,
      },
      { status: 500 }
    );
  }
}
