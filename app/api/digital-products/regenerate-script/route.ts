/**
 * POST: Generate a single new script for a digital product with a chosen angle.
 * Body: { productId: string, angle: "Story Angle" | "Problem/Solution Angle" | "Before/After Angle" | "Social Proof Angle" | "Curiosity/Mystery Angle" }
 * Returns: { script: { id, title, length, hook, body, cta } } with [PAIN] and [BENEFIT] tags for frontend highlighting.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";

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
      return 'Use a transformation or result as the hook (e.g. "Meet Sarah who transformed her life..."); body has a mini story or relatable scenario; CTA. Title the script "Story Angle".';
    case "Problem/Solution Angle":
      return 'Hook on the problem (e.g. "Tired of living paycheck to paycheck? Here\'s the fix..."); body on how the product solves it; strong CTA. Title the script "Problem/Solution Angle".';
    case "Before/After Angle":
      return 'Hook on the "before" state; body contrasts with "after" results; CTA with urgency. Title the script "Before/After Angle".';
    case "Social Proof Angle":
    case "Social Proof/Results Angle":
      return 'Hook with results or numbers (e.g. "1000+ people have already used this to..."); body with social proof and outcomes; CTA. Title the script "Social Proof/Results Angle".';
    case "Curiosity/Mystery Angle":
    case "Curiosity/Controversy Angle":
      return 'Hook with curiosity gap or mild controversy (e.g. "Nobody talks about this passive income method..."); body reveals value without giving everything away; CTA. Title the script "Curiosity/Controversy Angle".';
    default:
      return `Use the angle: ${angle}. Title the script "${angle}".`;
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

    const prompt = `You are an expert at writing short-form video scripts for digital products (TikTok, Reels, Shorts). Generate exactly ONE script for this product using the requested angle.

PRODUCT:
- Name: "${title}"
- Description: ${description || "(none provided)"}
- Niche/audience: ${niche}

ANGLE: ${angle}
${angleInstructions(angle)}

HIGHLIGHTING (required): So the frontend can highlight pain points and benefits, wrap text in tags:
- For pain points and emotional triggers (e.g. struggling, stressed, frustrated, overwhelmed, broke, stuck, failing, worried, anxious, can't afford, tired of): wrap in [PAIN]...[/PAIN]. Example: "I was [PAIN]stressed[/PAIN] about money."
- For benefits and transformation words (e.g. thriving, freedom, transformed, saved, confident, calm, organized, successful, easy, finally): wrap in [BENEFIT]...[/BENEFIT]. Example: "Now I'm [BENEFIT]thriving[/BENEFIT]."
Use these tags in hook, body, and cta where they naturally appear. Do not tag every word — only the strongest pain and benefit phrases.

RULES:
- Hook: 1–2 sentences, under ~100 chars, punchy and scroll-stopping.
- Body: 2–4 short paragraphs, under ~300 chars total, benefit-focused.
- CTA: one clear action, under ~100 chars (e.g. "Link in bio", "Comment X for the guide").
- Write for 30-second videos. Be specific to this product and niche.
- No placeholders like [product name] — use the actual product name.

Return ONLY valid JSON (no markdown, no code fence):
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
          {
            role: "system",
            content:
              "You generate one short-form video script for digital products. Return only valid JSON with title, hook, body, cta (strings). Use [PAIN]...[/PAIN] for pain/emotional triggers and [BENEFIT]...[/BENEFIT] for benefits where they appear.",
          },
          { role: "user", content: prompt },
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
