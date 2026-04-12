import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { productHistoryTable } from "@/db/schema/product-history-schema";
import { eq, and } from "drizzle-orm";
import {
  generateProductOutline,
  generateSingleSectionBody,
  type GenerateProductContentParams,
} from "@/lib/generate-product-content";
import { generateProductImage } from "@/lib/generateProductImages";

export const maxDuration = 300; // 5 min (Vercel Pro); local dev no limit

const VALID_FORMATS = ["ebook", "guide", "workbook", "spreadsheet", "notion", "course", "checklist", "journal", "planner", "template"] as const;

/** Normalize and validate format from body or DB (handles "Course Outline", "course_outline", "Notion Template", "notion_template", etc.). */
function normalizeFormat(value: string | undefined | null, fallback: string): string {
  if (value == null || typeof value !== "string") return fallback;
  const lower = value.toLowerCase().trim();
  if (lower === "course outline" || lower === "course_outline") return "course";
  if (lower === "checklist pack") return "checklist";
  if (lower === "notion template" || lower === "notion_template") return "notion";
  return VALID_FORMATS.includes(lower as (typeof VALID_FORMATS)[number]) ? lower : fallback;
}

type SectionRow = { id: string; title: string; content: string; contentHtml?: string; order: number; imageUrl?: string };

const BATCH_SIZE = 10; // Generate up to 10 sections in parallel (e.g. planner has 7, all in one batch)

/**
 * POST: Internal. Generates product content: outline first, then sections in parallel batches.
 * Client sees progress as each batch completes.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiRl = await checkApiRateLimit(userId);
  if (apiRl) return apiRl;

  const { id: productId } = await params;
  if (!productId) return NextResponse.json({ error: "Product ID required" }, { status: 400 });

  let existing: { id: string; userId: string; status: string; format: string; title: string; niche: string; customizationOptions: unknown } | undefined;
  try {
    const body = await request.json().catch(() => ({}));
    const [existingRow] = await db
      .select({
        id: productsTable.id,
        userId: productsTable.userId,
        status: productsTable.status,
        format: productsTable.format,
        title: productsTable.title,
        niche: productsTable.niche,
        customizationOptions: productsTable.customizationOptions,
      })
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .limit(1);
    existing = existingRow;

    // Verify ownership — only the product owner may trigger generation
    if (!existing) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    if (existing.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const isRetry = body.retry === true && existing?.status === "failed";
    if (isRetry) {
      await db
        .update(productsTable)
        .set({ status: "generating", generationError: null, updatedAt: new Date() })
        .where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId)));
    }

    const niche = body.niche != null ? (typeof body.niche === "string" ? body.niche : (body.niche as { name?: string }).name ?? "") : "";
    const product = body.product as { name?: string; included?: string; why?: string } | undefined;
    const productName = (product?.name ?? body.productName ?? (isRetry ? existing?.title : "") ?? "").trim();
    const productIncluded = product?.included ?? body.productIncluded ?? "";
    const productWhy = product?.why ?? body.productWhy ?? "";
    let productDescription = (typeof body.productDescription === "string" ? body.productDescription : "") || (productName ? `${productIncluded}. ${productWhy}` : "");
    const formatFromBody = body.format != null ? String(body.format).trim() : "";
    const formatFromDb = existing?.format ?? "";
    const format = normalizeFormat(formatFromBody || formatFromDb, "ebook");
    const spreadsheetDisclaimer = "⚠️ This is a step-by-step tutorial guide (PDF). You will learn how to create this spreadsheet yourself in Excel or Google Sheets. This is NOT a pre-made spreadsheet file - it's an educational guide that teaches you valuable Excel skills.";
    if (format === "spreadsheet") {
      productDescription = productDescription ? `${productDescription} ${spreadsheetDisclaimer}` : spreadsheetDisclaimer;
    }
    const hooks = Array.isArray(body.hooks) ? body.hooks : [];
    const ctas = Array.isArray(body.ctas) ? body.ctas : [];
    const hookTexts = hooks.map((h: string | { text?: string }) => (typeof h === "string" ? h : h?.text ?? ""));
    const ctaTexts = ctas.map((c: string | { text?: string }) => (typeof c === "string" ? c : c?.text ?? ""));
    const nicheName = (typeof niche === "string" ? niche : (niche as { name?: string })?.name ?? "") || (isRetry ? existing?.niche ?? "" : "") || "";

    if (!existing) {
      console.error("[products/process] Product not found:", productId);
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    if (!isRetry && existing.status !== "generating") {
      return NextResponse.json({ message: "Already processed" });
    }

    const customizationOptions =
      body.customizationOptions != null && typeof body.customizationOptions === "object"
        ? (body.customizationOptions as GenerateProductContentParams["customizationOptions"])
        : existing?.customizationOptions != null && typeof existing.customizationOptions === "object"
          ? (existing.customizationOptions as GenerateProductContentParams["customizationOptions"])
          : undefined;

    const subFocus = typeof body.subFocus === "string" ? body.subFocus.trim() : undefined;
    const params: GenerateProductContentParams = {
      productName,
      productDescription,
      productIncluded,
      productWhy,
      niche: nicheName,
      format,
      subFocus: subFocus || undefined,
      hookTexts: hookTexts.filter(Boolean),
      ctaTexts: ctaTexts.filter(Boolean),
      customizationOptions,
    };

    // 1. Generate outline (retry once on failure so products are generated no matter what)
    let outline: { id: string; title: string }[];
    try {
      outline = await generateProductOutline(params);
    } catch (outlineErr) {
      console.warn("[products/process] Outline failed, retrying once:", outlineErr);
      outline = await generateProductOutline(params);
    }
    if (!outline?.length) {
      outline = [{ id: "intro", title: productName ? `${productName} – Getting started` : "Introduction" }];
    }
    const initialSections: SectionRow[] = outline.map((s, i) => ({
      id: s.id,
      title: s.title,
      content: "",
      order: i + 1,
    }));

    await db
      .update(productsTable)
      .set({
        content: { sections: initialSections },
        updatedAt: new Date(),
      })
      .where(eq(productsTable.id, productId));
    if (format !== "planner") {
      console.log("[DIAG] OUTLINE step 4 — saved to DB", { productId, format, sectionCount: initialSections.length });
    }

    const imageContext = { productName, niche: nicheName, format };
    const sectionsWithContent: SectionRow[] = [];

    for (let start = 0; start < outline.length; start += BATCH_SIZE) {
      const batch = outline.slice(start, start + BATCH_SIZE);
      const batchIndices = batch.map((_, j) => start + j);

      const results = await Promise.allSettled(
        batch.map((section, j) =>
          generateSingleSectionBody(params, section, batchIndices[j], outline.length)
        )
      );

      const bodiesAndPrompts: { bodyHtml: string; imagePrompt?: string }[] = [];
      for (let j = 0; j < batch.length; j++) {
        const section = batch[j];
        const i = batchIndices[j];
        let bodyHtml = "";
        let imagePrompt: string | undefined;
        const result = results[j];
        if (result.status === "fulfilled") {
          bodyHtml = result.value.body || "";
          imagePrompt = result.value.imagePrompt;
        } else {
          console.warn("[products/process] Section body failed, retrying once:", section.id, result.reason);
          try {
            const retry = await generateSingleSectionBody(params, section, i, outline.length);
            bodyHtml = retry.body || "";
            imagePrompt = retry.imagePrompt;
          } catch (retryErr) {
            console.error("[products/process] Section failed after retry:", section.id, retryErr);
            bodyHtml = "<p><em>Content generation failed for this section. You can edit it in the editor.</em></p>";
          }
        }
        bodiesAndPrompts.push({ bodyHtml, imagePrompt });
      }

      const imageUrls = await Promise.all(
        batch.map((section) => {
          const prompt = `Professional illustration of ${section.title}, clean minimalist style, suitable for a digital product`;
          return generateProductImage(prompt, imageContext).catch((err) => {
            console.warn("[products/process] Image gen failed for", section.id, err);
            return undefined;
          });
        })
      );

      for (let j = 0; j < batch.length; j++) {
        const imageUrl = imageUrls[j] ?? undefined;
        const sectionTitle = batch[j].title;
        console.log("[content-pages]", {
          formatType: format,
          pageSectionTitle: sectionTitle,
          imageUrlExists: imageUrl != null,
        });
        sectionsWithContent.push({
          id: batch[j].id,
          title: batch[j].title,
          content: bodiesAndPrompts[j].bodyHtml,
          contentHtml: bodiesAndPrompts[j].bodyHtml,
          order: batchIndices[j] + 1,
          imageUrl,
        });
      }

      await db
        .update(productsTable)
        .set({
          content: { sections: [...sectionsWithContent] },
          updatedAt: new Date(),
        })
        .where(eq(productsTable.id, productId));
      if (format !== "planner") {
        console.log("[DIAG] BATCH saved to DB", { productId, format, sectionsCount: sectionsWithContent.length });
      }
    }

    if (format === "planner") {
      console.log("[products/process] Planner raw AI response (sections before final save):", JSON.stringify(sectionsWithContent.map((s) => ({ id: s.id, title: s.title, contentLength: (s.content ?? "").length, contentPreview: (s.content ?? "").slice(0, 200) })), null, 2));
    }

    const designSettings: Record<string, unknown> = {
      template: "modern",
      colors: { primary: "#FF6B35", secondary: "#004E89", accent: "#F7B32B", graphics: "#FF6B35" },
      typography: { heading: "Inter", body: "Open Sans", size: 16 },
      layout:
        format === "ebook"
          ? { maxWidth: "wide", margins: 2.5, paragraphSpacing: 1.25, sectionSpacing: 2, lineHeight: 1.7, alignment: "left" }
          : undefined,
    };
    if (format === "spreadsheet") {
      designSettings.subtitle = spreadsheetDisclaimer;
    }

    await db
      .update(productsTable)
      .set({
        content: { sections: sectionsWithContent },
        designSettings,
        status: "draft",
        updatedAt: new Date(),
      })
      .where(eq(productsTable.id, productId));
    if (format !== "planner") {
      console.log("[DIAG] Final save to DB — status=draft", { productId, format, totalSections: sectionsWithContent.length });
    }

    if (userId) {
      try {
        await db.insert(productHistoryTable).values({
          userId,
          productId,
          productTitle: productName || existing.title,
          formatType: format,
          contentJson: {
            sections: sectionsWithContent,
            designSettings,
          },
          status: "complete",
        });
      } catch (historyErr) {
        console.error("[products/process] product_history insert failed:", historyErr);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const timestamp = new Date().toISOString();
    const formatForLog = (existing as { format?: string } | undefined)?.format ?? "unknown";
    const nicheForLog = (existing as { niche?: string } | undefined)?.niche ?? "";
    console.error("[products/process] Generation error (saving fallback draft):", {
      format: formatForLog,
      niche: nicheForLog,
      productId,
      timestamp,
      error: errorMessage,
    });
    const fallbackSections: SectionRow[] = [
      {
        id: "intro",
        title: "Getting started",
        content: "<p>Content generation hit a temporary issue. You can edit this product and add your own content, or use <strong>Regenerate</strong> in the editor to try again.</p>",
        order: 1,
      },
    ];
    const fallbackDesignSettings: Record<string, unknown> = {
      template: "modern",
      colors: { primary: "#FF6B35", secondary: "#004E89", accent: "#F7B32B", graphics: "#FF6B35" },
      typography: { heading: "Inter", body: "Open Sans", size: 16 },
    };
    try {
      await db
        .update(productsTable)
        .set({
          content: { sections: fallbackSections },
          designSettings: fallbackDesignSettings,
          status: "draft",
          generationError: errorMessage.slice(0, 2000),
          updatedAt: new Date(),
        })
        .where(eq(productsTable.id, productId));
    } catch (dbErr) {
      console.error("[products/process] Could not save fallback draft:", dbErr);
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true });
  }
}
