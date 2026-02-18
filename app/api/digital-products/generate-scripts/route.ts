/**
 * POST: Generate 4 video script variations for a digital product in one API call.
 * Angles: Story, Problem/Solution, Social Proof/Results, Curiosity/Controversy.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";
import { getVideoLengthOptionOrDefault } from "@/lib/video-length-options";

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
    const targetDurationSec = typeof body.targetDurationSec === "number" ? body.targetDurationSec : 30;
    const lengthOpt = getVideoLengthOptionOrDefault(targetDurationSec);
    const { durationSec, wordsMin, wordsMax } = lengthOpt;

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

    const prompt = `You are an expert at writing short-form video scripts for digital products (TikTok, Reels, Shorts). Generate exactly 4 scripts for this product in one response. Each script must feel specific to the product, not generic.

PRODUCT:
- Name: "${title}"
- Description: ${description || "(none provided)"}
- Niche/audience: ${niche}

Generate 4 scripts with these exact angles (in this order):
1. "Story Angle" — e.g. "Meet Sarah who transformed her life..." Hook on a person or transformation story; body with a mini story or relatable scenario; CTA.
2. "Problem/Solution Angle" — e.g. "Tired of living paycheck to paycheck? Here's the fix..." Hook on the problem; body on how the product solves it; strong CTA.
3. "Social Proof/Results Angle" — e.g. "1000+ people have already used this to..." Hook with results or numbers; body with social proof and outcomes; CTA.
4. "Curiosity/Controversy Angle" — e.g. "Nobody talks about this passive income method..." Hook with curiosity gap or mild controversy; body reveals value without giving everything away; CTA.

HIGHLIGHTING (required): Wrap text in tags where they fit:
- Pain/emotional triggers: [PAIN]...[/PAIN]
- Benefits/transformation: [BENEFIT]...[/BENEFIT]
Only tag the strongest phrases.

RULES:
- Hook: 1–2 sentences, punchy and scroll-stopping.
- Body: 2–4 short paragraphs, benefit-focused.
- CTA: one clear action.
- TARGET LENGTH: ${durationSec} seconds when read aloud. Each script must be approximately ${wordsMin}–${wordsMax} words total. Do not exceed this word count.
- Be specific to this product and niche. No placeholders — use the actual product name.

Return ONLY valid JSON (no markdown, no code fence):
{
  "scripts": [
    { "title": "Story Angle", "hook": "...", "body": "...", "cta": "..." },
    { "title": "Problem/Solution Angle", "hook": "...", "body": "...", "cta": "..." },
    { "title": "Social Proof/Results Angle", "hook": "...", "body": "...", "cta": "..." },
    { "title": "Curiosity/Controversy Angle", "hook": "...", "body": "...", "cta": "..." }
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
              "You generate short-form video scripts for digital products. Return only valid JSON with a 'scripts' array. Each item has title, hook, body, cta (strings). Use [PAIN]...[/PAIN] for pain/emotional triggers and [BENEFIT]...[/BENEFIT] for benefits where they appear in the text.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 2500,
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
    const defaultTitles = ["Story Angle", "Problem/Solution Angle", "Social Proof/Results Angle", "Curiosity/Controversy Angle"];

    const scripts: GeneratedScriptItem[] = raw.slice(0, 4).map((s, i) => ({
      id: `gen-${i + 1}`,
      title: typeof s.title === "string" ? s.title : defaultTitles[i] ?? `Script ${i + 1}`,
      length: durationSec,
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
