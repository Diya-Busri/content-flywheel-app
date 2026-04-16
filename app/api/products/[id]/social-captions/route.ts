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
 * POST /api/products/[id]/social-captions
 * Returns { tiktok, instagram, twitter } — ready-to-post captions for each platform.
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
    const hashtags = Array.isArray(ma.hashtags) ? (ma.hashtags as string[]).slice(0, 5).map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ") : "";

    const brandVoice = await getBrandVoice(userId).catch(() => "");

    const userPrompt = `Create social media captions AND titles for a digital product video.

PRODUCT: "${title}"
NICHE: ${niche}
FORMAT: ${format}
DESCRIPTION: ${description || "A digital product for " + niche}
HASHTAGS: ${hashtags || "#digitalproduct #passiveincome"}

Return ONLY valid JSON (no markdown, no code fences) in this exact shape:
{
  "tiktok_title": "...",
  "tiktok": "...",
  "instagram_title": "...",
  "instagram": "...",
  "youtube_title": "...",
  "twitter": "..."
}

Rules:
- tiktok_title: Short punchy video title, max 8 words, no hashtags
- TikTok caption: Hook in first line, conversational, trending language, 3-5 relevant hashtags at the end, max 150 words
- instagram_title: Benefit-driven title, max 10 words, no hashtags
- Instagram caption: Story-driven, benefit-focused, 5-8 hashtags at the end, max 200 words
- youtube_title: SEO-optimised title with keyword near the front, max 60 characters, no hashtags
- Twitter/X: Punchy, 1 bold claim, max 240 characters total including any hashtags`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: [
              "You are a social media copywriter for digital product creators. You write scroll-stopping captions that drive clicks and sales. Return only valid JSON.",
              brandVoice ? `\n${brandVoice}` : "",
            ].join(""),
          },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.75,
        max_tokens: 800,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[social-captions] OpenAI error:", response.status, errText);
      return NextResponse.json({ error: "Failed to generate captions" }, { status: 502 });
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = (data.choices?.[0]?.message?.content ?? "").trim();

    let parsed: { tiktok?: string; instagram?: string; twitter?: string; tiktok_title?: string; instagram_title?: string; youtube_title?: string } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Invalid response from AI" }, { status: 502 });
    }

    return NextResponse.json({
      tiktok_title: parsed.tiktok_title ?? "",
      tiktok: parsed.tiktok ?? "",
      instagram_title: parsed.instagram_title ?? "",
      instagram: parsed.instagram ?? "",
      youtube_title: parsed.youtube_title ?? "",
      twitter: parsed.twitter ?? "",
    });
  } catch (err) {
    console.error("[social-captions]", err);
    return NextResponse.json({ error: "Failed to generate captions" }, { status: 500 });
  }
}
