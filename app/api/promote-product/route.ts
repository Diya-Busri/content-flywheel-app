import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;
    const rl = checkAiRateLimit(userId ?? null);
    if (rl) return rl;

    const body = await req.json().catch(() => ({}));
    const { productId } = body as { productId?: string };
    if (!productId?.trim()) return NextResponse.json({ error: "productId is required" }, { status: 400 });

    // Fetch the product (must belong to the user)
    const [product] = await db
      .select({
        id: productsTable.id,
        title: productsTable.title,
        niche: productsTable.niche,
        format: productsTable.format,
        marketingAssets: productsTable.marketingAssets,
      })
      .from(productsTable)
      .where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId), isNull(productsTable.deletedAt)))
      .limit(1);

    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const description = product.marketingAssets?.productDescription ?? "";
    const productContext = [
      `Product: "${product.title}"`,
      `Format: ${product.format}`,
      product.niche ? `Niche / target audience: ${product.niche}` : "",
      description ? `Description: ${description}` : "",
    ].filter(Boolean).join("\n");

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: "OpenAI not configured" }, { status: 503 });

    const openai = new OpenAI({ apiKey });

    const systemPrompt = `You are a viral content strategist who turns digital products into high-performing social content.
You write content that sounds like a real human — direct, specific, no hype words like "game-changer", "revolutionary", "supercharge", "elevate", or "unlock".
You always write as if you personally use and love the product. Short punchy sentences. Honest tone.`;

    const userPrompt = `Generate a content bundle to promote this digital product. Be specific to what it actually covers — no generic filler.

${productContext}

Return ONLY a valid JSON object with exactly this shape (no markdown, no code fences):
{
  "productName": "short name of the product",
  "oneLiner": "one sentence that nails what it does",
  "tiktok": {
    "hook": "first 3 seconds — one punchy line that stops the scroll",
    "script": "full 30-60 second TikTok/Reels script with natural pauses. Write it as spoken word, not bullet points. Include a soft CTA at the end."
  },
  "instagram": {
    "caption": "Instagram caption with line breaks for readability. Start with the hook. End with a CTA and 5 relevant hashtags."
  },
  "email": {
    "subject": "email subject line (under 50 chars, curiosity-driven)",
    "preview": "preview text (under 90 chars)",
    "body": "short email body — 3-4 paragraphs max. Conversational, not corporate. Clear CTA at the end."
  },
  "twitter": {
    "thread": ["tweet 1 (hook)", "tweet 2", "tweet 3 (CTA)"]
  }
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 1800,
      temperature: 0.8,
    });

    const raw = response.choices[0]?.message?.content ?? "";
    const cleaned = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "AI returned invalid JSON. Try again." }, { status: 500 });
    }

    return NextResponse.json({ result: parsed });
  } catch (err) {
    console.error("[promote-product]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Something went wrong" }, { status: 500 });
  }
}
