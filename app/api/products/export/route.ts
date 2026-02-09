import { NextResponse } from "next/server";
import { generateProduct, isValidProductType } from "@/lib/generators";
import type { ProductType, ProductDetails, PageBackground, ExportDesignSettings, PlacedElementExport } from "@/lib/generators/types";

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]/g, "-").replace(/-+/g, "-").slice(0, 100) || "product";
}

/**
 * Server-only export: generate PDF/DOCX/XLSX/Notion/PPTX and return as file or JSON.
 * Use this from the client instead of importing @/lib/generators or docx/pptxgenjs (they use node:fs).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const format = (body.format ?? "ebook") as string;
    const title = typeof body.title === "string" ? body.title : "My Product";
    const description = typeof body.description === "string" ? body.description : "";
    const niche = typeof body.niche === "string" ? body.niche : "";
    const sections = Array.isArray(body.sections)
      ? (body.sections as Array<{ title: string; body: string }>)
      : [];
    const pageBackgrounds = Array.isArray(body.pageBackgrounds)
      ? (body.pageBackgrounds as PageBackground[])
      : undefined;
    const designSettings = body.designSettings != null && typeof body.designSettings === "object"
      ? (body.designSettings as ExportDesignSettings)
      : undefined;
    const placedElementsByPage = Array.isArray(body.placedElementsByPage)
      ? (body.placedElementsByPage as PlacedElementExport[][])
      : undefined;

    const productDetails: ProductDetails = {
      title,
      description,
      niche,
      sections,
      pageBackgrounds,
      designSettings,
      placedElementsByPage,
    };

    if (format === "notion") {
      const result = await generateProduct("notion", productDetails);
      const notionResult = result as { markdown: string; csv: string; instructions: string };
      return NextResponse.json({
        success: true,
        format: "notion",
        markdown: notionResult.markdown,
        csv: notionResult.csv,
        instructions: notionResult.instructions,
      });
    }

    if (format === "docx") {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");
      const children = [
        new Paragraph({ children: [new TextRun(title)], heading: HeadingLevel.TITLE, spacing: { after: 400 } }),
        ...sections.flatMap((s) => [
          new Paragraph({ children: [new TextRun(s.title)], heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 200 } }),
          new Paragraph({ children: [new TextRun(s.body)], spacing: { after: 200 } }),
        ]),
      ];
      const doc = new Document({ sections: [{ children }] });
      const buf = await Packer.toBuffer(doc);
      return new NextResponse(buf, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${sanitizeFilename(title)}.docx"`,
        },
      });
    }

    if (format === "pptx") {
      const PptxGenJS = (await import("pptxgenjs")).default;
      const pres = new PptxGenJS();
      pres.title = title;
      const titleSlide = pres.addSlide();
      titleSlide.addText(title, { x: 0.5, y: 1.5, w: 9, h: 1.2, fontSize: 32, bold: true, align: "center" });
      titleSlide.addText(niche, { x: 0.5, y: 2.8, w: 9, fontSize: 18, align: "center", color: "666666" });
      sections.forEach((section) => {
        const slide = pres.addSlide();
        slide.addText(section.title, { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 24, bold: true });
        const bodyText = section.body.replace(/<[^>]*>/g, "").slice(0, 500);
        slide.addText(bodyText + (section.body.length > 500 ? "..." : ""), { x: 0.5, y: 1, w: 9, h: 5, fontSize: 14 });
      });
      const buf = await pres.write({ outputType: "arraybuffer" });
      return new NextResponse(buf, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "Content-Disposition": `attachment; filename="${sanitizeFilename(title)}.pptx"`,
        },
      });
    }

    if (format === "spreadsheet") {
      const buffer = await generateProduct("spreadsheet", productDetails) as ArrayBuffer;
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${sanitizeFilename(title)}.xlsx"`,
        },
      });
    }

    const pdfFormats = ["ebook", "workbook", "course", "checklist"] as const;
    const pdfType = pdfFormats.includes(format as (typeof pdfFormats)[number]) ? (format as ProductType) : "ebook";
    if (!isValidProductType(pdfType)) {
      return NextResponse.json({ error: "Invalid format" }, { status: 400 });
    }
    // CRITICAL: When export is from the editor, request body contains the CURRENT sections.
    // Always use section-based PDF (one page per section, actual content) so PDF matches editor.
    // Workbook/course/checklist generators use hardcoded templates and would export wrong content.
    const { generateEbook } = await import("@/lib/generators/ebook");
    const buffer = await generateEbook(productDetails) as ArrayBuffer;
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${sanitizeFilename(title)}.pdf"`,
      },
    });
  } catch (err) {
    console.error("Export failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Export failed" },
      { status: 500 }
    );
  }
}
