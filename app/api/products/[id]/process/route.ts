import { NextResponse } from "next/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq } from "drizzle-orm";
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
  const { id: productId } = await params;
  if (!productId) return NextResponse.json({ error: "Product ID required" }, { status: 400 });

  try {
    const body = await request.json().catch(() => ({}));
    const niche = body.niche != null ? (typeof body.niche === "string" ? body.niche : (body.niche as { name?: string }).name ?? "") : "";
    const product = body.product as { name?: string; included?: string; why?: string } | undefined;
    const productName = (product?.name ?? body.productName ?? "").trim();
    const productIncluded = product?.included ?? body.productIncluded ?? "";
    const productWhy = product?.why ?? body.productWhy ?? "";
    let productDescription = (typeof body.productDescription === "string" ? body.productDescription : "") || (productName ? `${productIncluded}. ${productWhy}` : "");
    const [existing] = await db
      .select({
        id: productsTable.id,
        status: productsTable.status,
        format: productsTable.format,
        customizationOptions: productsTable.customizationOptions,
      })
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .limit(1);

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
    const nicheName = typeof niche === "string" ? niche : (niche as { name?: string })?.name ?? "";

    if (!existing) {
      console.error("[products/process] Product not found:", productId);
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    if (existing.status !== "generating") {
      return NextResponse.json({ message: "Already processed" });
    }

    const customizationOptions =
      body.customizationOptions != null && typeof body.customizationOptions === "object"
        ? (body.customizationOptions as GenerateProductContentParams["customizationOptions"])
        : existing?.customizationOptions != null && typeof existing.customizationOptions === "object"
          ? (existing.customizationOptions as GenerateProductContentParams["customizationOptions"])
          : undefined;

    const params: GenerateProductContentParams = {
      productName,
      productDescription,
      productIncluded,
      productWhy,
      niche: nicheName,
      format,
      hookTexts: hookTexts.filter(Boolean),
      ctaTexts: ctaTexts.filter(Boolean),
      customizationOptions,
    };

    // 1. Generate outline only (fast), save so client can show "Generating chapter 1 of N"
    const outline = await generateProductOutline(params);
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

    const imageContext = { productName, niche: nicheName, format };
    const sectionsWithContent: SectionRow[] = [];
    const wantAiImages = customizationOptions?.contentStyle === "text_with_ai_images";

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
        batch.map((section, j) => {
          const prompt = bodiesAndPrompts[j].imagePrompt?.trim();
          if (!wantAiImages || !prompt) return Promise.resolve(undefined);
          return generateProductImage(prompt, imageContext).catch((err) => {
            console.warn("[products/process] Image gen failed for", section.id, err);
            return undefined;
          });
        })
      );

      for (let j = 0; j < batch.length; j++) {
        sectionsWithContent.push({
          id: batch[j].id,
          title: batch[j].title,
          content: bodiesAndPrompts[j].bodyHtml,
          contentHtml: bodiesAndPrompts[j].bodyHtml,
          order: batchIndices[j] + 1,
          imageUrl: imageUrls[j],
        });
      }

      await db
        .update(productsTable)
        .set({
          content: { sections: [...sectionsWithContent] },
          updatedAt: new Date(),
        })
        .where(eq(productsTable.id, productId));
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

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[products/process] Error:", err);
    try {
      await db
        .update(productsTable)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(productsTable.id, productId));
    } catch {
      // ignore
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}
