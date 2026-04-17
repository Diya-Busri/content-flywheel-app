import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { db } from "@/db/db";
import { podProductsTable } from "@/db/schema/pod-products-schema";
import { eq, and } from "drizzle-orm";
import { getBrandVoice } from "@/lib/brand-voice";

export const dynamic = "force-dynamic";

/**
 * POST /api/pod/promo-script
 * Generate a short-form promo video script (hook / body / cta) for a Print on Demand product.
 * Body: { productId: string }
 * Returns: { hook, body, cta, productName }
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;
    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 503 });

    const body = await request.json().catch(() => ({})) as { productId?: string };
    if (!body.productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

    const [product] = await db
      .select()
      .from(podProductsTable)
      .where(and(eq(podProductsTable.id, body.productId), eq(podProductsTable.userId, userId)))
      .limit(1);

    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const productName = product.title?.trim() || "Custom Merch";
    const productType = product.blueprintTitle?.trim() || "clothing";
    const brandVoice = await getBrandVoice(userId).catch(() => "");

    const prompt = `Write a short-form vertical video script (TikTok/Instagram Reels style) to promote a print-on-demand product.

PRODUCT NAME: "${productName}"
PRODUCT TYPE: ${productType}

Return ONLY valid JSON with this exact shape:
{
  "hook": "...",
  "body": "...",
  "cta": "..."
}

Rules:
- hook: 1–2 punchy sentences to open the video. Grab attention in the first 3 seconds. Start with a strong statement or question about the product. Max 30 words.
- body: 3–5 sentences describing what makes this product special — the design, quality, who it's for, why people love it. Conversational and enthusiastic. Max 60 words.
- cta: 1–2 sentences telling viewers to buy/check it out. Create urgency (limited stock, link in bio, etc.). Max 25 words.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: [
              "You are a short-form video scriptwriter specialising in merch and print-on-demand products. Return only valid JSON.",
              brandVoice ? `\n${brandVoice}` : "",
            ].join(""),
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 400,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[pod/promo-script] OpenAI error:", response.status, errText);
      return NextResponse.json({ error: "Failed to generate script" }, { status: 502 });
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = (data.choices?.[0]?.message?.content ?? "").trim();

    let parsed: { hook?: string; body?: string; cta?: string } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Invalid response from AI" }, { status: 502 });
    }

    return NextResponse.json({
      hook: parsed.hook ?? "",
      body: parsed.body ?? "",
      cta: parsed.cta ?? "",
      productName,
    });
  } catch (err) {
    console.error("[pod/promo-script]", err);
    return NextResponse.json({ error: "Failed to generate script" }, { status: 500 });
  }
}
