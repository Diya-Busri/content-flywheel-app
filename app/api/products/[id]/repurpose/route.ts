import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { eq, and } from "drizzle-orm";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const format: "twitter" | "linkedin" | "email" | "instagram" = body.format ?? "twitter";

    const [product] = await db
      .select({ title: productsTable.title, content: productsTable.content })
      .from(productsTable)
      .where(and(eq(productsTable.id, params.id), eq(productsTable.userId, userId)))
      .limit(1);

    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const [bv] = await db
      .select({ brandName: brandVoiceTable.brandName, tone: brandVoiceTable.tone, targetAudience: brandVoiceTable.targetAudience })
      .from(brandVoiceTable)
      .where(eq(brandVoiceTable.userId, userId))
      .limit(1);

    const sections: Array<{ title: string; content: string }> =
      (product.content as { sections?: Array<{ title: string; content: string }> })?.sections ?? [];

    const contentSnippet = sections
      .slice(0, 5)
      .map((s) => `## ${s.title}\n${s.content?.slice(0, 300)}`)
      .join("\n\n")
      .slice(0, 2000);

    const formatInstructions: Record<string, string> = {
      twitter: `Write a Twitter/X thread (5-7 tweets, numbered 1/ 2/ etc.) that hooks readers and drives curiosity about this product. Each tweet max 280 chars. End with a CTA.`,
      linkedin: `Write a LinkedIn post (200-300 words) with a strong hook, 3 key insights from the product, and a CTA to get it. Use line breaks for readability.`,
      email: `Write a short promotional email (subject line + body, ~200 words) that teases the value inside the product and drives clicks to buy.`,
      instagram: `Write an Instagram caption (150-200 words) with a hook, value bullets, and a CTA. Include 5 relevant hashtags at the end.`,
    };

    const brandContext = bv
      ? `Brand: ${bv.brandName ?? "Content creator"}. Tone: ${bv.tone ?? "conversational"}. Audience: ${bv.targetAudience ?? "creators and entrepreneurs"}.`
      : "";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert content marketer who repurposes digital products into social media content. ${brandContext} Write compelling, authentic copy that feels like the creator's voice.`,
        },
        {
          role: "user",
          content: `Product: "${product.title}"\n\nContent preview:\n${contentSnippet}\n\nTask: ${formatInstructions[format]}\n\nReturn ONLY the post content, no extra commentary.`,
        },
      ],
      max_tokens: 600,
    });

    const result = completion.choices[0]?.message?.content?.trim() ?? "";

    return NextResponse.json({ content: result, format });
  } catch (err) {
    console.error("[repurpose] error:", err);
    return NextResponse.json({ error: "Failed to generate content" }, { status: 500 });
  }
}
