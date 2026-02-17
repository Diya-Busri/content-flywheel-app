/**
 * POST: Generate fresh video scripts for a digital product (Pain Point, Story, Value Bomb).
 * Uses product title + description from DB. No caching — each call returns new scripts.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";

export type GeneratedScriptItem = {
  id: string;
  title: string;
  length: number;
  hook: string;
  body: string;
  cta: string;
};

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const productId = typeof body.productId === "string" ? body.productId.trim() : "";
    if (!productId) {
      return NextResponse.json({ error: "productId required" }, { status: 400 });
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

    const marketing = (product.marketingAssets ?? {}) as {
      productTitle?: string;
      productDescription?: string;
    };
    const title = (marketing.productTitle ?? product.title ?? "").trim() || "Your product";
    const description = (marketing.productDescription ?? "").trim() || "";
    const niche = (product.niche ?? "").trim() || "general audience";

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 503 }
      );
    }

    const prompt = `You are an expert at writing short-form video scripts for digital products (TikTok, Reels, Shorts). Generate exactly 3 scripts for this product. Each script must feel specific to the product, not generic.

PRODUCT:
- Name: "${title}"
- Description: ${description || "(none provided)"}
- Niche/audience: ${niche}

Generate 3 scripts with these angles:
1. "Pain Point Angle" — hook on the problem, body on how the product solves it, strong CTA.
2. "Story Angle" — hook on a transformation or result, body with a mini story or social proof, CTA.
3. "Value Bomb Angle" — hook on a specific tip or outcome, body with clear value and benefits, CTA.

RULES:
- Hook: 1–2 sentences, under ~100 chars, punchy and scroll-stopping.
- Body: 2–4 short paragraphs, under ~300 chars total, benefit-focused.
- CTA: one clear action, under ~100 chars (e.g. "Link in bio", "Comment X for the guide").
- Write for 30-second videos. Be specific to this product and niche.
- No placeholders like [product name] — use the actual product name.

Return ONLY valid JSON (no markdown, no code fence):
{
  "scripts": [
    { "title": "Pain Point Angle", "hook": "...", "body": "...", "cta": "..." },
    { "title": "Story Angle", "hook": "...", "body": "...", "cta": "..." },
    { "title": "Value Bomb Angle", "hook": "...", "body": "...", "cta": "..." }
  ]
}`;

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
            content:
              "You generate short-form video scripts for digital products. Return only valid JSON with a 'scripts' array. Each item has title, hook, body, cta (strings).",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[digital-products/generate-scripts] OpenAI error:", response.status, err);
      return NextResponse.json(
        { error: "Failed to generate scripts" },
        { status: 502 }
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    let content = (data.choices?.[0]?.message?.content ?? "").trim();
    if (content.startsWith("```")) {
      content = content.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }
    const parsed = JSON.parse(content) as { scripts?: Array<{ title?: string; hook?: string; body?: string; cta?: string }> };
    const raw = Array.isArray(parsed.scripts) ? parsed.scripts : [];

    const scripts: GeneratedScriptItem[] = raw.slice(0, 3).map((s, i) => ({
      id: `gen-${i + 1}`,
      title: typeof s.title === "string" ? s.title : ["Pain Point Angle", "Story Angle", "Value Bomb Angle"][i] ?? `Script ${i + 1}`,
      length: 30,
      hook: typeof s.hook === "string" ? s.hook.trim() : "",
      body: typeof s.body === "string" ? s.body.trim() : "",
      cta: typeof s.cta === "string" ? s.cta.trim() : "",
    }));

    return NextResponse.json({ scripts });
  } catch (e) {
    console.error("[digital-products/generate-scripts]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to generate scripts" },
      { status: 500 }
    );
  }
}
