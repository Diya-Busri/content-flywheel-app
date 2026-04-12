import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { db } from "@/db/db";
import { podProductsTable } from "@/db/schema/pod-products-schema";
import { eq } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiRl = await checkApiRateLimit(userId);
  if (apiRl) return apiRl;
  const rl = checkAiRateLimit(userId);
  if (rl) return rl;

  let productId: string | undefined;
  try {
    const body = await req.json() as { productId?: string };
    productId = body.productId;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!productId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 });
  }

  const [product] = await db
    .select()
    .from(podProductsTable)
    .where(eq(podProductsTable.id, productId))
    .limit(1);

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // Verify ownership
  if (product.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const productType = product.blueprintTitle ?? "custom merch product";
  const userPrompt = `Generate 3 TikTok captions for a merch drop.

Product name: "${product.title}"
Product type: ${productType}
Brand vibe: streetwear, hype drops, limited edition merch

Each caption must have:
1. A strong opening hook (first line grabs attention in 0.5 seconds)
2. A short punchy body (1-2 lines max)
3. Relevant hashtags (8-12 hashtags, mix of niche and broad)

Return ONLY valid JSON in this exact format, no extra text:
{
  "captions": [
    "caption 1 text with hashtags",
    "caption 2 text with hashtags",
    "caption 3 text with hashtags"
  ]
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a viral TikTok content strategist specialising in streetwear and merch drops. Generate captions that create hype and FOMO. Always respond with valid JSON only.",
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      temperature: 0.9,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let captions: string[] = [];

    try {
      const parsed = JSON.parse(raw) as { captions?: string[] };
      captions = Array.isArray(parsed.captions) ? parsed.captions.slice(0, 3) : [];
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    if (captions.length === 0) {
      return NextResponse.json({ error: "No captions generated" }, { status: 500 });
    }

    return NextResponse.json({ captions });
  } catch (err) {
    console.error("[pod/captions] OpenAI error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}
