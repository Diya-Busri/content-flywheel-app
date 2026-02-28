/**
 * POST /api/video-guide/regenerate-full-script
 * Regenerates the full script (hook, body, cta) for a video guide.
 * Body: { libraryScriptId?: string, findByProductName?: string, customUserPrompt?: string }
 * - libraryScriptId: guide to update (required unless findByProductName is set).
 * - findByProductName: find guide whose cleaned productName matches (e.g. "Personal Development Journals").
 * - customUserPrompt: if set, use this as the user prompt (with product context appended); otherwise use default angle prompt.
 * Uses cleaned product title (before first | and -). Updates the library script content and returns the new script.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { scriptsTable } from "@/db/schema/library-schema";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";
import { cleanProductTitle } from "@/lib/product-title";
import { mapScriptToSceneOverlays } from "@/lib/video-guide-scene-overlays";

const SYSTEM_PROMPT = `You are an expert short-form video scriptwriter for TikTok and Instagram Reels.
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
HOOK (0-3s): Start with a specific pain point about the product's topic. NOT the product name. Make it feel real and relatable.
BODY (3-25s): Agitate the problem (why people fail at this), then naturally introduce the product as the solution. Keep it conversational. Short sentences.
CTA (25-30s): One clear action. Link in bio. Urgent but human.

Rules:
- Product name appears ONCE only, naturally in the script. Use the exact product name given in the user message (the PRODUCT block). Never use a placeholder.
- Max 15 words per sentence.
- No corporate language.
- Write like a real TikTok creator talking to camera.

Return only valid JSON with title, hook, body, cta (strings). No markdown, no code fences.`;

export async function POST(request: NextRequest) {
  try {
    console.log("[regenerate-full-script] POST called");
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    let libraryScriptId = typeof body.libraryScriptId === "string" ? body.libraryScriptId.trim() : "";
    const findByProductName = typeof body.findByProductName === "string" ? body.findByProductName.trim() : "";
    const customUserPrompt = typeof body.customUserPrompt === "string" ? body.customUserPrompt.trim() : "";
    const lengthAdjustment = body.lengthAdjustment === "shorter" || body.lengthAdjustment === "longer" ? body.lengthAdjustment : undefined;

    if (!libraryScriptId && !findByProductName) {
      return NextResponse.json({ error: "libraryScriptId or findByProductName required" }, { status: 400 });
    }

    let row: { id: string; content: string | Record<string, unknown>; platform: string; title?: string; productId?: string | null } | undefined;

    if (libraryScriptId) {
      const [r] = await db
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
      row = r;
    } else {
      const candidates = await db
        .select()
        .from(scriptsTable)
        .where(
          and(eq(scriptsTable.userId, userId), eq(scriptsTable.platform, "video-guide"), isNull(scriptsTable.deletedAt))
        );
      const targetClean = cleanProductTitle(findByProductName) || findByProductName;
      const match = candidates.find((r) => {
        let c: Record<string, unknown> = {};
        try {
          c = typeof r.content === "string" ? JSON.parse(r.content) : { ...r.content };
        } catch {
          return false;
        }
        const cleaned = cleanProductTitle((c.productName as string) ?? "");
        return cleaned === targetClean || (cleaned && targetClean && cleaned.toLowerCase() === targetClean.toLowerCase());
      });
      row = match;
    }

    if (!row) {
      return NextResponse.json(
        { error: libraryScriptId ? "Video guide not found" : "No video guide found for that product name" },
        { status: 404 }
      );
    }
    if (row.platform !== "video-guide") {
      return NextResponse.json({ error: "Not a video guide" }, { status: 400 });
    }
    libraryScriptId = row.id;

    let content: Record<string, unknown> = {};
    try {
      content = typeof row.content === "string" ? JSON.parse(row.content) : { ...row.content };
    } catch {
      return NextResponse.json({ error: "Invalid guide content" }, { status: 400 });
    }

    // Resolve product name: guide content first, then linked product from DB
    const contentProductName = (content.productName as string) ?? "";
    let linkedProductTitle: string | null = null;
    let linkedProductTitleField: string | null = null;
    let linkedProductMarketingTitle: string | null = null;
    if (row.productId) {
      const [product] = await db
        .select({ title: productsTable.title, marketingAssets: productsTable.marketingAssets })
        .from(productsTable)
        .where(
          and(
            eq(productsTable.id, row.productId),
            eq(productsTable.userId, userId),
            isNull(productsTable.deletedAt)
          )
        )
        .limit(1);
      if (product) {
        linkedProductTitleField = product.title ?? null;
        const ma = product.marketingAssets as { productTitle?: string } | null;
        linkedProductMarketingTitle = (ma?.productTitle ?? "").trim() || null;
        linkedProductTitle = linkedProductMarketingTitle || linkedProductTitleField || null;
      }
    }
    const rowTitle = row.title ?? "";
    const fromRowTitle = rowTitle.replace(/^Video Guide:\s*/i, "").trim();

    // Single raw title from guide content, linked product, or script row
    const rawTitle =
      contentProductName.trim() ||
      linkedProductTitle ||
      fromRowTitle ||
      "";
    // Cleaned product name: everything before first | and before first - (per Step 3). Never use placeholder when we have any title.
    let productName =
      rawTitle.split("|")[0].split("-")[0].trim() || rawTitle.trim() || fromRowTitle.split("|")[0].split("-")[0].trim() || fromRowTitle || "the product";
    if (productName === "the product" && fromRowTitle) {
      productName = fromRowTitle.split("|")[0].split("-")[0].trim() || fromRowTitle;
    }

    // Step 1 — Log actual product title from DB for debugging (e.g. guideId b778c2c3-a8b7-41bf-9f9c-ae687ed86c53)
    console.log("[regenerate-full-script] Product name resolution:", {
      guideId: libraryScriptId,
      contentProductName: contentProductName || "(empty)",
      rowTitle,
      rowProductId: row.productId ?? "(none)",
      linkedProduct_titleField: linkedProductTitleField ?? "(no linked product)",
      linkedProduct_marketingProductTitle: linkedProductMarketingTitle ?? "(none)",
      linkedProductTitle: linkedProductTitle ?? "(not fetched)",
      rawTitle: rawTitle || "(empty)",
      productName,
    });
    const description = (content.overview as string) ?? (content.productDescription as string) ?? "";
    const niche = (content.niche as string)?.trim() || "general audience";

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 503 });
    }

    const productBlock = `PRODUCT:
- The product is called ${productName}.
- Description: ${description ? `"${String(description).slice(0, 1500)}"` : "(none provided)"}
- Niche/audience: ${niche}

IMPORTANT: The product is called "${productName}".
Use "${productName}" by name in the script.
NEVER write "your product" or "the product" — always use the actual name.

Return ONLY valid JSON (no markdown, no code fences):
{
  "title": "Script",
  "hook": "...",
  "body": "...",
  "cta": "..."
}`;

    const currentScript = content.script as { hook?: string; body?: string; cta?: string } | undefined;
    const hasCurrentScript =
      currentScript &&
      (typeof currentScript.hook === "string" || typeof currentScript.body === "string" || typeof currentScript.cta === "string");

    let lengthInstruction = "";
    if (lengthAdjustment === "shorter" && hasCurrentScript) {
      const cur = currentScript!;
      lengthInstruction = `TASK: Make the script SHORTER by about 30%. Keep the HOOK and CTA intact (minimal or no changes). Shorten the BODY by removing less essential sentences while keeping the message and product name "${productName}".\n\nCurrent script:\nHOOK: ${cur.hook ?? ""}\nBODY: ${cur.body ?? ""}\nCTA: ${cur.cta ?? ""}\n\nRewrite and return the shortened script in the same JSON format.\n\n`;
    } else if (lengthAdjustment === "longer" && hasCurrentScript) {
      const cur = currentScript!;
      lengthInstruction = `TASK: Make the script LONGER by expanding the BODY by about 30%. Add more pain point agitation and/or social proof. Keep the HOOK and CTA largely unchanged. Keep the product name "${productName}" and conversational tone.\n\nCurrent script:\nHOOK: ${cur.hook ?? ""}\nBODY: ${cur.body ?? ""}\nCTA: ${cur.cta ?? ""}\n\nRewrite and return the expanded script in the same JSON format.\n\n`;
    }

    const baseUserPrompt = customUserPrompt
      ? `${customUserPrompt}\n\n${productBlock}`
      : `Write a script for ${productName}.

HOOK: Start with a specific pain point about ${niche} or the product topic. NOT the product name. Make it feel real and relatable.

BODY: Agitate the problem (why people fail at this), then naturally introduce ${productName} as the solution. Example: "${productName} helps you stay on track". Only refer to it as ${productName} — never say "your product" or "the product". Keep it conversational. Short sentences.

CTA: One clear action. Link in bio. Urgent but human.

Rules: The product is called ${productName}. Use that exact name once in the script. Max 15 words per sentence. No corporate language. Write like a real TikTok creator talking to camera.

${productBlock}`;

    const userPrompt = lengthInstruction ? `${lengthInstruction}${productBlock}` : baseUserPrompt;

    console.log("PRODUCT NAME RECEIVED:", productName);
    console.log("FULL PROMPT:", userPrompt);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[video-guide/regenerate-full-script] OpenAI error:", response.status, err);
      return NextResponse.json({ error: "Failed to generate script" }, { status: 502 });
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    let text = (data.choices?.[0]?.message?.content ?? "").trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }
    const parsed = JSON.parse(text) as { hook?: string; body?: string; cta?: string };
    const replacePlaceholder = (s: string) =>
      s.replace(/\bYour product\b/gi, productName).replace(/\bYour Product\b/g, productName);
    const hook = replacePlaceholder(typeof parsed.hook === "string" ? parsed.hook.trim() : "");
    const bodyText = replacePlaceholder(typeof parsed.body === "string" ? parsed.body.trim() : "");
    const cta = replacePlaceholder(typeof parsed.cta === "string" ? parsed.cta.trim() : "");

    const newScript = { hook, body: bodyText, cta };
    const updatedContent = { ...content, script: newScript };

    const contentScenes = Array.isArray(content.scenes) ? (content.scenes as Array<{ timing?: string; textOverlay?: unknown; [key: string]: unknown }>) : [];
    if (contentScenes.length > 0) {
      const chunks = mapScriptToSceneOverlays(newScript, contentScenes.length);
      const updatedScenes = contentScenes.map((scene, i) => {
        const chunk = chunks[i] ?? "";
        const existing = scene.textOverlay;
        const existingObj =
          typeof existing === "object" && existing && !Array.isArray(existing) && "exactText" in (existing as object)
            ? (existing as { exactText?: string; fontStyle?: string; size?: string; position?: string; color?: string; animation?: string; timingNote?: string })
            : Array.isArray(existing) && existing[0] && typeof existing[0] === "object"
              ? (existing[0] as { exactText?: string; fontStyle?: string; size?: string; position?: string; color?: string; animation?: string; timingNote?: string })
              : {};
        return { ...scene, textOverlay: { ...existingObj, exactText: chunk } };
      });
      updatedContent.scenes = updatedScenes;
    }

    await db
      .update(scriptsTable)
      .set({ content: JSON.stringify(updatedContent), updatedAt: new Date() })
      .where(and(eq(scriptsTable.id, libraryScriptId), eq(scriptsTable.userId, userId)));

    return NextResponse.json({ script: newScript });
  } catch (e) {
    console.error("[video-guide/regenerate-full-script]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to regenerate script" },
      { status: 500 }
    );
  }
}
