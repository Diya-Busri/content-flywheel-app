export const dynamic = "force-dynamic";
/**
 * POST: Regenerate a single script angle for a video guide loaded from library (no productId).
 * Body: { libraryScriptId: string, angle: string }
 * Loads guide from library script content and uses productName/productDescription for context.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { db } from "@/db/db";
import { scriptsTable } from "@/db/schema/library-schema";
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
    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;
    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const libraryScriptId = typeof body.libraryScriptId === "string" ? body.libraryScriptId.trim() : "";
    const angle =
      typeof body.angle === "string" && SCRIPT_ANGLES.includes(body.angle as (typeof SCRIPT_ANGLES)[number])
        ? (body.angle as (typeof SCRIPT_ANGLES)[number])
        : "Story Angle";

    // Inline mode: caller passes productName/productDescription directly (no saved library entry yet)
    const inlineProductName = typeof body.productName === "string" ? body.productName.trim() : "";
    const inlineProductDescription = typeof body.productDescription === "string" ? body.productDescription.trim() : "";

    let productName: string;
    let description: string;

    if (libraryScriptId) {
      // Load product context from saved library entry
      const [row] = await db
        .select()
        .from(scriptsTable)
        .where(
          and(
            eq(scriptsTable.id, libraryScriptId),
            eq(scriptsTable.userId, userId),
            isNull(scriptsTable.deletedAt)
          )
        )
        .limit(1);
      if (!row) return NextResponse.json({ error: "Script not found" }, { status: 404 });
      const isVideoGuide = row.platform === "video-guide" || row.platform === "content-studio";
      if (!isVideoGuide || !row.content) {
        return NextResponse.json({ error: "Not a video guide" }, { status: 400 });
      }
      let guide: { productName?: string; productDescription?: string };
      try {
        guide = JSON.parse(row.content) as { productName?: string; productDescription?: string };
      } catch {
        return NextResponse.json({ error: "Invalid guide content" }, { status: 400 });
      }
      productName = (guide.productName ?? "").trim();
      description = ((guide as { productDescription?: string }).productDescription ?? "").trim();
    } else if (inlineProductName) {
      // Inline mode: use product context passed directly in the request body
      productName = inlineProductName;
      description = inlineProductDescription;
    } else {
      return NextResponse.json({ error: "libraryScriptId or productName required" }, { status: 400 });
    }

    const title = cleanProductTitle(productName) || productName || "Product";
    const niche = "general audience";

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
      console.error("[video-guide/regenerate-angle] OpenAI error:", response.status, err);
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

    const script = {
      id: `regen-${Date.now()}`,
      title: typeof parsed.title === "string" ? parsed.title.trim() : angle,
      length: 30,
      hook: typeof parsed.hook === "string" ? parsed.hook.trim() : "",
      body: typeof parsed.body === "string" ? parsed.body.trim() : "",
      cta: typeof parsed.cta === "string" ? parsed.cta.trim() : "",
    };

    return NextResponse.json({ script });
  } catch (e) {
    console.error("[video-guide/regenerate-angle]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to generate script" },
      { status: 500 }
    );
  }
}
