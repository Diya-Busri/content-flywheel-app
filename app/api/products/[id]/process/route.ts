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

type SectionRow = { id: string; title: string; content: string; contentHtml?: string; order: number; imageUrl?: string };

/**
 * POST: Internal. Generates product content section-by-section and updates the product.
 * Outline first, then one section at a time so client can show progress and avoid timeouts.
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
    const format = VALID_FORMATS.includes(body.format) ? body.format : "ebook";
    const spreadsheetDisclaimer = "⚠️ This is a step-by-step tutorial guide (PDF). You will learn how to create this spreadsheet yourself in Excel or Google Sheets. This is NOT a pre-made spreadsheet file - it's an educational guide that teaches you valuable Excel skills.";
    if (format === "spreadsheet") {
      productDescription = productDescription ? `${productDescription} ${spreadsheetDisclaimer}` : spreadsheetDisclaimer;
    }
    const hooks = Array.isArray(body.hooks) ? body.hooks : [];
    const ctas = Array.isArray(body.ctas) ? body.ctas : [];
    const hookTexts = hooks.map((h: string | { text?: string }) => (typeof h === "string" ? h : h?.text ?? ""));
    const ctaTexts = ctas.map((c: string | { text?: string }) => (typeof c === "string" ? c : c?.text ?? ""));
    const nicheName = typeof niche === "string" ? niche : (niche as { name?: string })?.name ?? "";

    const [existing] = await db
      .select({ id: productsTable.id, status: productsTable.status })
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .limit(1);

    if (!existing) {
      console.error("[products/process] Product not found:", productId);
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    if (existing.status !== "generating") {
      return NextResponse.json({ message: "Already processed" });
    }

    const params: GenerateProductContentParams = {
      productName,
      productDescription,
      productIncluded,
      productWhy,
      niche: nicheName,
      format,
      hookTexts: hookTexts.filter(Boolean),
      ctaTexts: ctaTexts.filter(Boolean),
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

    for (let i = 0; i < outline.length; i++) {
      const section = outline[i];
      let bodyHtml = "";
      let imagePrompt: string | undefined;

      try {
        const result = await generateSingleSectionBody(params, section, i, outline.length);
        bodyHtml = result.body || "";
        imagePrompt = result.imagePrompt;
      } catch (err) {
        console.warn("[products/process] Section body failed, retrying once:", section.id, err);
        try {
          const retry = await generateSingleSectionBody(params, section, i, outline.length);
          bodyHtml = retry.body || "";
          imagePrompt = retry.imagePrompt;
        } catch (retryErr) {
          console.error("[products/process] Section failed after retry:", section.id, retryErr);
          bodyHtml = "<p><em>Content generation failed for this section. You can edit it in the editor.</em></p>";
        }
      }

      let imageUrl: string | undefined;
      if (imagePrompt?.trim()) {
        try {
          imageUrl = await generateProductImage(imagePrompt, imageContext);
        } catch (err) {
          console.warn("[products/process] Image gen failed for", section.id, err);
        }
      }

      sectionsWithContent.push({
        id: section.id,
        title: section.title,
        content: bodyHtml,
        contentHtml: bodyHtml,
        order: i + 1,
        imageUrl,
      });

      // Update DB after each section so client can show progress (chapter X of Y)
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
