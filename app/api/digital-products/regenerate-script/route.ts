/**
 * POST: Generate a single new script for a digital product with a chosen angle.
 * Body: { productId: string, angle: "Story Angle" | "Problem/Solution Angle" | "Before/After Angle" | "Social Proof Angle" | "Curiosity/Mystery Angle" }
 * Returns: { script: { id, title, length, hook, body, cta } }. Script text is plain (no [PAIN]/[BENEFIT] tags); pain and benefits are written as real sentences.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";
import { cleanProductTitle } from "@/lib/product-title";

const SCRIPT_ANGLES = [
  "Story Angle",
  "Problem/Solution Angle",
  "Before/After Angle",
  "Social Proof Angle",
  "Social Proof/Results Angle",
  "Curiosity/Mystery Angle",
  "Curiosity/Controversy Angle",
] as const;

export type ScriptAngle = (typeof SCRIPT_ANGLES)[number];

export type RegeneratedScript = {
  id: string;
  title: string;
  length: number;
  hook: string;
  body: string;
  cta: string;
};

function angleInstructions(angle: string): string {
  switch (angle) {
    case "Story Angle":
      return "Transformation or relatable scenario; human and specific — never 'Meet [name]'. Pain point or curiosity hook; agitate then solution; one clear CTA.";
    case "Problem/Solution Angle":
      return "Specific pain point hook (not generic 'Are you struggling'); agitate the problem then introduce the solution naturally; urgent but natural CTA.";
    case "Before/After Angle":
      return "Hook on the 'before' state; body contrasts with 'after' results; CTA urgent but natural.";
    case "Social Proof Angle":
    case "Social Proof/Results Angle":
      return "Results or numbers in hook; body with social proof and outcomes; one clear CTA.";
    case "Curiosity/Mystery Angle":
    case "Curiosity/Controversy Angle":
      return "Curiosity gap or bold claim in hook; body reveals value naturally; CTA urgent but not desperate.";
    default:
      return `Follow the rules: pain/curiosity hook, agitate then solution, product name once only. Title: "${angle}".`;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const productId = typeof body.productId === "string" ? body.productId.trim() : "";
    const angle = typeof body.angle === "string" && SCRIPT_ANGLES.includes(body.angle as ScriptAngle)
      ? (body.angle as ScriptAngle)
      : "Story Angle";

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
      return NextResponse.json({ product: null }, { status: 404 });
    }

    const marketing = (product.marketingAssets ?? {}) as {
      productTitle?: string;
      productDescription?: string;
    };
    const rawTitle = (marketing.productTitle ?? product.title ?? "").trim();
    const title = cleanProductTitle(rawTitle) || rawTitle || "Product";
    const description = (marketing.productDescription ?? "").trim() || "";
    const niche = (product.niche ?? "").trim() || "general audience";

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 503 }
      );
    }

    const systemPrompt = `You are an expert short-form video scriptwriter for TikTok and Instagram Reels.
Write scripts that feel human, conversational and emotionally engaging.

Rules:
- Hook MUST open with a pain point, bold claim, or curiosity gap — never with the product name
- Never start with "Meet [name]" or "Are you struggling" — be more specific and real
- The product name should only appear ONCE in the entire script, naturally
- Write like a real person talking, not an ad
- Use short punchy sentences. Max 15 words per sentence.
- Body should agitate the problem before presenting the solution
- CTA should feel urgent but not desperate

Pain point hooks that work:
- "I wasted 3 years trying to figure this out..."
- "Nobody talks about why journaling actually fails..."
- "The reason you keep starting over has nothing to do with motivation..."

Structure:
HOOK (0-3s): One sentence. Pain point or curiosity gap only.
BODY (3-25s): Agitate the problem (2 sentences), then introduce the solution naturally (2-3 sentences), then social proof or outcome (1-2 sentences)
CTA (25-30s): One clear action. Urgent but natural.

Return only valid JSON with title, hook, body, cta (strings). No markdown, no code fences.`;

    const userPrompt = `Generate exactly ONE script for this product. Angle: ${angle}. ${angleInstructions(angle)}

PRODUCT:
- Name: "${title}"
- Description: ${description || "(none provided)"}
- Niche/audience: ${niche}

Return ONLY valid JSON:
{
  "title": "${angle}",
  "hook": "...",
  "body": "...",
  "cta": "..."
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
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[digital-products/regenerate-script] OpenAI error:", response.status, err);
      return NextResponse.json(
        { error: "Failed to generate script" },
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
    const parsed = JSON.parse(content) as { title?: string; hook?: string; body?: string; cta?: string };

    const script: RegeneratedScript = {
      id: `regen-${Date.now()}`,
      title: typeof parsed.title === "string" ? parsed.title.trim() : angle,
      length: 30,
      hook: typeof parsed.hook === "string" ? parsed.hook.trim() : "",
      body: typeof parsed.body === "string" ? parsed.body.trim() : "",
      cta: typeof parsed.cta === "string" ? parsed.cta.trim() : "",
    };

    return NextResponse.json({ script });
  } catch (e) {
    console.error("[digital-products/regenerate-script]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to generate script" },
      { status: 500 }
    );
  }
}
