import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { cleanProductTitle } from "@/lib/product-title";
import { getBrandVoice } from "@/lib/brand-voice";

export const dynamic = "force-dynamic";

/**
 * POST /api/products/bundle-copy
 * Body: { productIds: string[] }
 * Returns { bundleName, description, priceRange, platforms }
 * — AI-generated bundle name, sales copy, and pricing for a set of products.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;
    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const productIds: string[] = Array.isArray(body.productIds) ? body.productIds.slice(0, 5) : [];
    if (productIds.length < 2) {
      return NextResponse.json({ error: "Select at least 2 products to create a bundle" }, { status: 400 });
    }

    const products = await db.select({
      id: productsTable.id,
      title: productsTable.title,
      niche: productsTable.niche,
      format: productsTable.format,
      marketingAssets: productsTable.marketingAssets,
    })
      .from(productsTable)
      .where(and(
        eq(productsTable.userId, userId),
        isNull(productsTable.deletedAt),
        inArray(productsTable.id, productIds)
      ));

    if (products.length < 2) {
      return NextResponse.json({ error: "Could not find the selected products" }, { status: 404 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 503 });

    const brandVoice = await getBrandVoice(userId).catch(() => "");

    const productList = products.map((p) => {
      const rawTitle = (p.title ?? "").trim();
      const title = cleanProductTitle(rawTitle) || rawTitle || "Digital Product";
      const ma = (p.marketingAssets ?? {}) as Record<string, unknown>;
      const desc = typeof ma.productDescription === "string" ? ma.productDescription.slice(0, 200) : "";
      return `- ${title} (${p.format ?? "PDF"}, ${p.niche ?? "general"})${desc ? `: ${desc}` : ""}`;
    }).join("\n");

    const userPrompt = `Create bundle sales copy for these ${products.length} digital products:

${productList}

Return ONLY valid JSON (no markdown, no code fences):
{
  "bundleName": "Short catchy bundle name",
  "tagline": "One punchy sentence (max 15 words)",
  "description": "3-4 sentence sales description for the bundle — lead with transformation, list what's inside, end with CTA",
  "priceRange": "Recommended price range e.g. $37–$47",
  "savings": "e.g. Save 40% vs buying separately",
  "bullets": ["Benefit 1", "Benefit 2", "Benefit 3", "Benefit 4"],
  "platforms": {
    "gumroad": "Short platform-optimised listing for Gumroad (max 150 words)",
    "etsy": "Short platform-optimised listing for Etsy (max 150 words)"
  }
}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: [
              "You are an expert digital product marketer. You create high-converting bundle copy. Return only valid JSON.",
              brandVoice ? `\n${brandVoice}` : "",
            ].join(""),
          },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 900,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[bundle-copy] OpenAI error:", response.status, errText);
      return NextResponse.json({ error: "Failed to generate bundle copy" }, { status: 502 });
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = (data.choices?.[0]?.message?.content ?? "").trim();

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Invalid AI response" }, { status: 502 });
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[bundle-copy]", err);
    return NextResponse.json({ error: "Failed to generate bundle copy" }, { status: 500 });
  }
}
