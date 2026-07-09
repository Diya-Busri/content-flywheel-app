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

const PLATFORM_PROMPTS: Record<string, (title: string, niche: string, format: string) => string> = {
  beacons: (title, niche, format) =>
    `Write a short high-converting Beacons store description for: ${title}, niche: ${niche}, format: ${format}. 2 punchy sentences, 3 benefit bullet points, 1 CTA. Under 150 words.`,
  gumroad: (title, niche, format) =>
    `Write a Gumroad product description for: ${title}, niche: ${niche}, format: ${format}. Conversational tone, lead with the problem it solves, bullet the contents, end with CTA. Under 200 words.`,
  etsy: (title, niche, format) =>
    `Write an Etsy listing description for: ${title}, niche: ${niche}, format: ${format}. Include keywords naturally, lead with the transformation, list what's included, add a short CTA. Under 200 words.`,
  "stan-store": (title, niche, format) =>
    `Write a Stan Store product description for: ${title}, niche: ${niche}, format: ${format}. Short, punchy, creator-audience tone, 3 benefit bullets, strong CTA. Under 150 words.`,
  payhip: (title, niche, format) =>
    `Write a Payhip product description for: ${title}, niche: ${niche}, format: ${format}. Clear and benefit-led, include what's inside, who it's for, and a CTA. Under 200 words.`,
};

/**
 * POST /api/products/[id]/platform-copy
 * Body: { platform: "beacons" | "gumroad" | "etsy" | "stan-store" | "payhip" }
 * Returns { copy: string } — AI-generated platform-specific listing copy.
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
    const apiRl = await checkApiRateLimit(userId);

    if (apiRl) return apiRl;

    const rl = checkAiRateLimit(userId);
    if (rl) return rl;
    const { id: productId } = await params;
    if (!productId) {
      return NextResponse.json({ error: "Product ID required" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const platform = typeof body.platform === "string" ? body.platform.toLowerCase().trim() : "";
    const buildPrompt = PLATFORM_PROMPTS[platform];
    if (!buildPrompt) {
      return NextResponse.json(
        { error: "Invalid platform. Use: beacons, gumroad, etsy, stan-store, payhip" },
        { status: 400 }
      );
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

    const rawTitle = (product.title ?? "").trim();
    const title = cleanProductTitle(rawTitle) || rawTitle || "Digital Product";
    const niche = (product.niche ?? "").trim() || "general";
    const format = (product.format ?? "").trim() || "PDF";

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 503 }
      );
    }

    const userPrompt = buildPrompt(title, niche, format);
    const brandVoice = await getBrandVoice(userId).catch(() => "");

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
            content: [
              "You write marketplace listing copy for digital products. Return only the requested copy, no preamble or labels.",
              brandVoice ? `\n${brandVoice}` : "",
            ].join(""),
          },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[platform-copy] OpenAI error:", response.status, errText);
      return NextResponse.json(
        { error: "Failed to generate platform copy" },
        { status: 502 }
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const copy = (data.choices?.[0]?.message?.content ?? "").trim();

    return NextResponse.json({ copy });
  } catch (err) {
    console.error("[platform-copy]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate platform copy" },
      { status: 500 }
    );
  }
}
