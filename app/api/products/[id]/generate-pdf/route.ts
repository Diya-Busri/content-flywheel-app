import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { buildSinglePageHtml, type PdfProductPayload, type PdfSection } from "@/lib/pdf-product-html";

export const runtime = "nodejs";
export const maxDuration = 60;

const CANVAS_WIDTH_PX = 800;
const CANVAS_HEIGHT_PX = 1100;
const PDF_WIDTH_MM = (CANVAS_WIDTH_PX / 96) * 25.4;
const PDF_HEIGHT_MM = (CANVAS_HEIGHT_PX / 96) * 25.4;

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]/g, "-").replace(/-+/g, "-").slice(0, 100) || "product";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json().catch(() => ({}));

    const title = typeof body.title === "string" ? body.title : "My Product";
    const sectionsRaw = Array.isArray(body.sections) ? body.sections : [];
    const sections: PdfSection[] = sectionsRaw.map((s: { title?: string; body?: string; contentHtml?: string; id?: string }) => ({
      id: typeof s.id === "string" ? s.id : undefined,
      title: typeof s.title === "string" ? s.title : "Section",
      body: typeof s.body === "string" ? s.body : undefined,
      contentHtml: typeof s.contentHtml === "string" ? s.contentHtml : undefined,
    }));
    const pageBackgrounds = Array.isArray(body.pageBackgrounds) ? body.pageBackgrounds : undefined;
    const designSettings = body.designSettings != null && typeof body.designSettings === "object" ? body.designSettings : undefined;
    const placedElementsByPage = Array.isArray(body.placedElementsByPage) ? body.placedElementsByPage : undefined;

    const payload: PdfProductPayload = {
      title,
      sections: sections.length ? sections : [{ title, body: "" }],
      pageBackgrounds,
      designSettings,
      placedElementsByPage,
    };

    const pageCount = Math.max(1, sections.length || 1);

    // eslint-disable-next-line -- puppeteer is optional at build time
    const puppeteer = require("puppeteer");
    const browser = await puppeteer.launch({
      headless: true,
      timeout: 60000,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });

    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(60000);
      page.setDefaultNavigationTimeout(60000);
      await page.setViewport({ width: CANVAS_WIDTH_PX + 100, height: CANVAS_HEIGHT_PX + 100 });

      const pdfBuffers: Buffer[] = [];

      for (let i = 0; i < pageCount; i++) {
        const html = buildSinglePageHtml(payload, i);
        await page.setContent(html, {
          waitUntil: "load",
          timeout: 60000,
        });
        await page.evaluate(() => document.fonts?.ready);
        await new Promise((r) => setTimeout(r, 200));

        const buffer = await page.pdf({
          width: `${PDF_WIDTH_MM}mm`,
          height: `${PDF_HEIGHT_MM}mm`,
          printBackground: true,
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
        });
        pdfBuffers.push(Buffer.from(buffer));
      }

      const mergedPdf = await PDFDocument.create();
      for (const buf of pdfBuffers) {
        const src = await PDFDocument.load(buf);
        const copiedPages = await mergedPdf.copyPages(src, src.getPageIndices());
        copiedPages.forEach((p) => mergedPdf.addPage(p));
      }

      const mergedBytes = await mergedPdf.save();
      const filename = `${sanitizeFilename(title)}.pdf`;

      return new NextResponse(Buffer.from(mergedBytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error("Generate PDF failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "PDF generation failed" },
      { status: 500 }
    );
  }
}
