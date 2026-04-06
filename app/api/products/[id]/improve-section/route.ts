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
 * POST /api/products/[id]/improve-section
 * Body: { sectionTitle: string; content: string; instruction?: string }
 * Returns: { improved: string } — rewritten section content.
 *
 * Unlike regenerate-section (which recreates from scratch), this takes the
 * existing content and makes it better: punchier, clearer, better structured.
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

    const [product] = await db.select()
      .from(productsTable)
      .where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId), isNull(productsTable.deletedAt)));
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const sectionTitle = typeof body.sectionTitle === "string" ? body.sectionTitle.trim() : "Section";
    const content = typeof body.content === "string" ? body.content.trim() : "";
    const instruction = typeof body.instruction === "string" ? body.instruction.trim() : "";

    if (!content) return NextResponse.json({ error: "content is required" }, { status: 400 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 503 });

    const rawTitle = (product.title ?? "").trim();
    const title = cleanProductTitle(rawTitle) || rawTitle || "Digital Product";
    const niche = (product.niche ?? "").trim() || "general";
    const format = (product.format ?? "").trim() || "PDF";
    const brandVoice = await getBrandVoice(userId).catch(() => "");

    const userPrompt = `Improve the following section from a digital product.

PRODUCT: "${title}" (${format}, niche: ${niche})
SECTION: "${sectionTitle}"
${instruction ? `SPECIFIC INSTRUCTION: ${instruction}\n` : ""}
CURRENT CONTENT:
${content}

Rewrite this section to be:
- More engaging and actionable
- Clearer and better structured
- Using concrete examples where possible
- Formatted with markdown (headers with ##, bullet points, bold key terms)
- Approximately the same length or slightly longer

Return ONLY the improved section content — no preamble, no "Here is the improved version:" labels.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: [
              "You are an expert content editor for digital products. You improve sections to be more engaging, clear, and actionable. Return only the improved content.",
              brandVoice ? `\n${brandVoice}` : "",
            ].join(""),
          },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.65,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[improve-section] OpenAI error:", response.status, errText);
      return NextResponse.json({ error: "Failed to improve section" }, { status: 502 });
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const improved = (data.choices?.[0]?.message?.content ?? "").trim();

    return NextResponse.json({ improved });
  } catch (err) {
    console.error("[improve-section]", err);
    return NextResponse.json({ error: "Failed to improve section" }, { status: 500 });
  }
}
