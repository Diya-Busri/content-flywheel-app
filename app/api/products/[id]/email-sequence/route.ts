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

export type EmailSequenceResult = {
  emails: Array<{
    subject: string;
    preview: string;
    body: string;
  }>;
};

/**
 * POST /api/products/[id]/email-sequence
 * Returns a 3-email welcome → value → pitch sequence for the product.
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

    const brandVoice = await getBrandVoice(userId).catch(() => "");

    const userPrompt = `Write a 3-email sales sequence for a digital product.

PRODUCT: "${title}"
NICHE: ${niche}
FORMAT: ${format}
DESCRIPTION: ${description || "A digital product for " + niche}

Return ONLY valid JSON (no markdown, no code fences) with this exact structure:
{
  "emails": [
    {
      "subject": "Email 1 subject line",
      "preview": "Preview text (max 90 chars)",
      "body": "Full email body"
    },
    {
      "subject": "Email 2 subject line",
      "preview": "Preview text",
      "body": "Full email body"
    },
    {
      "subject": "Email 3 subject line",
      "preview": "Preview text",
      "body": "Full email body"
    }
  ]
}

Email sequence:
- Email 1 (Day 0 — Welcome): Warm intro, set expectations, deliver the promise. End with a soft CTA to check out the product.
- Email 2 (Day 2 — Value): Share 1 actionable tip or insight related to the product topic. No hard sell.
- Email 3 (Day 4 — Pitch): Story-driven. Pain point → product as solution → scarcity/urgency → direct CTA with link placeholder [PRODUCT_LINK].

Keep each email under 250 words. Conversational, not corporate.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: [
              "You are an expert email copywriter for digital product creators. You write high-converting email sequences that feel personal and drive sales. Return only valid JSON.",
              brandVoice ? `\n${brandVoice}` : "",
            ].join(""),
          },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1500,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[email-sequence] OpenAI error:", response.status, errText);
      return NextResponse.json({ error: "Failed to generate email sequence" }, { status: 502 });
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = (data.choices?.[0]?.message?.content ?? "").trim();

    let parsed: EmailSequenceResult = { emails: [] };
    try {
      parsed = JSON.parse(raw) as EmailSequenceResult;
    } catch {
      return NextResponse.json({ error: "Invalid response from AI" }, { status: 502 });
    }

    if (!Array.isArray(parsed.emails) || parsed.emails.length === 0) {
      return NextResponse.json({ error: "No emails generated" }, { status: 502 });
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[email-sequence]", err);
    return NextResponse.json({ error: "Failed to generate email sequence" }, { status: 500 });
  }
}
