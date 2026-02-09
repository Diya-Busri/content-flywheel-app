import { NextResponse } from "next/server";
import { generateWorkbookPDFToBuffer } from "@/app/utils/generateWorkbookPDF";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/generate-workbook-pdf
 * Accepts product data { title, sections } and returns a PDF file.
 * sections: Array<{ id?, title, content?, contentHtml? }>
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const title = typeof body.title === "string" ? body.title : "Workbook";
    const sections = Array.isArray(body.sections)
      ? body.sections.map((s) => ({
          id: s.id,
          title: typeof s.title === "string" ? s.title : "(Untitled)",
          content: typeof s.content === "string" ? s.content : "",
          contentHtml: typeof s.contentHtml === "string" ? s.contentHtml : undefined,
        }))
      : [];

    const buffer = await generateWorkbookPDFToBuffer({ title, sections });
    const fileName = `${title.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "") || "workbook"}.pdf`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    console.error("Generate workbook PDF failed:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "PDF generation failed",
      },
      { status: 500 }
    );
  }
}
