/**
 * POST: Generate 4 video script variations for a digital product in one API call.
 * Angles: Story, Problem/Solution, Social Proof/Results, Curiosity/Controversy.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";
import { cleanProductTitle } from "@/lib/product-title";
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

Write the script in this structure:
HOOK (0-3s): One sentence. Pain point or curiosity gap only.
BODY (3-25s): Agitate the problem (2 sentences), then introduce the solution naturally (2-3 sentences), then social proof or outcome (1-2 sentences)
CTA (25-30s): One clear action. Urgent but natural.

Return only valid JSON with a "scripts" array. Each item has title, hook, body, cta (strings). No markdown, no code fences.`;

    const userPrompt = `Generate exactly 4 scripts for this product. Each script must follow the rules and structure above. Target ${durationSec}-second video; total word count ${wordsMin}–${wordsMax} words per script.

PRODUCT:
- Name: "${title}"
- Description: ${description || "(none provided)"}
- Niche/audience: ${niche}

Generate 4 scripts with these angles (in this order):
1. "Story Angle" — transformation or relatable scenario; human, not "Meet Sarah"
2. "Problem/Solution Angle" — specific pain point hook; agitate then solution
3. "Social Proof/Results Angle" — results or numbers; outcome-focused
4. "Curiosity/Controversy Angle" — curiosity gap or bold claim; reveal value naturally

Return ONLY valid JSON:
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
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
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
