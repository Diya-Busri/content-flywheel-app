import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { generateProductContent } from "@/lib/generate-product-content";

const VALID_FORMATS = ["ebook", "workbook", "spreadsheet", "notion", "course", "checklist"] as const;

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const niche = body.niche != null ? (typeof body.niche === "string" ? body.niche : (body.niche as { name?: string }).name ?? "") : "";
    const product = body.product as { name?: string; included?: string; why?: string; type?: string } | undefined;
    const productName = (product?.name ?? body.productName ?? "").trim() || "";
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

    if (!productName) {
      return NextResponse.json({ error: "product name is required" }, { status: 400 });
    }

    const nicheName = typeof niche === "string" ? niche : (niche as { name?: string })?.name ?? "";

    const sections = await generateProductContent({
      productName,
      productDescription,
      productIncluded,
      productWhy,
      niche: nicheName,
      format,
      hookTexts: hookTexts.filter(Boolean),
      ctaTexts: ctaTexts.filter(Boolean),
    });

    const content = {
      sections: sections.map((s, i) => ({
        id: s.id,
        title: s.title,
        content: s.body,
        order: i + 1,
      })),
    };

    const designSettings: Record<string, unknown> = {
      template: "modern",
      colors: { primary: "#FF6B35", secondary: "#004E89", accent: "#F7B32B" },
      typography: { heading: "Inter", body: "Open Sans", size: 16 },
    };
    if (format === "spreadsheet") {
      designSettings.subtitle = spreadsheetDisclaimer;
    }

    const [inserted] = await db
      .insert(productsTable)
      .values({
        userId,
        title: productName,
        niche: nicheName,
        format,
        content,
        designSettings,
        placedElements: [],
      })
      .returning({ id: productsTable.id });

    if (!inserted?.id) {
      return NextResponse.json({ error: "Failed to save product" }, { status: 500 });
    }

    return NextResponse.json({ productId: inserted.id, success: true });
  } catch (err) {
    console.error("Product create failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create product" },
      { status: 500 }
    );
  }
}
