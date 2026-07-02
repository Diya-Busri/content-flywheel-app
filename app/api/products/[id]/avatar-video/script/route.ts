export const dynamic = "force-dynamic";
/**
 * Avatar Video Script Generator
 * POST /api/products/[id]/avatar-video/script
 * Generates a short promo script from product data. No video is created.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { getBrandVoice } from "@/lib/brand-voice";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 20;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;

    const { id: productId } = await params;
    const [product] = await db
      .select({ title: productsTable.title, niche: productsTable.niche, format: productsTable.format })
      .from(productsTable)
      .where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId), isNull(productsTable.deletedAt)));

    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      const fallback = `Hey! If you're into ${product.niche}, you need to check out "${product.title}". This ${product.format} covers everything you need. Grab it now — link in bio!`;
      return NextResponse.json({ script: fallback });
    }

    const brandVoice = await getBrandVoice(userId).catch(() => "");
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 160,
      messages: [
        {
          role: "system",
          content: [
            "Write short, punchy TikTok video scripts. Conversational. No hashtags. No emojis. Under 75 words.",
            brandVoice ? `\n${brandVoice}` : "",
          ].join(""),
        },
        {
          role: "user",
          content: `Write a 15-second TikTok promo script for a digital product: "${product.title}" — a ${product.format} about ${product.niche}. Hook + 2 benefits + CTA. Under 75 words.`,
        },
      ],
    });

    const script = completion.choices[0]?.message?.content?.trim() ?? "";
    return NextResponse.json({ script });
  } catch (err) {
    console.error("[avatar-video/script]", err);
    return NextResponse.json({ error: "Script generation failed" }, { status: 500 });
  }
}
