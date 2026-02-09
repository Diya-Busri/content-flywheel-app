import { NextResponse } from "next/server";
import { generateWorkbookPDFToBuffer } from "@/app/utils/generateWorkbookPDF";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/generate-workbook-pdf
 * Body: { title: string, sections: Array<{ title: string, content?: string, contentHtml?: string }> }
 * Returns PDF file with Content-Disposition: attachment.
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    if (body === null || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const rawSections = Array.isArray(body.sections) ? body.sections : [];

    const sections = rawSections.map((s) => ({
      id: s.id,
      title: typeof s.title === "string" ? s.title : "(Untitled)",
      content: typeof s.content === "string" ? s.content : "",
      contentHtml: typeof s.contentHtml === "string" ? s.contentHtml : undefined,
    }));

    const buffer = await generateWorkbookPDFToBuffer({ title: title || "Workbook", sections });
    const safeName = (title || "workbook").replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "") || "workbook";
    const fileName = `${safeName}.pdf`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    console.error("Generate workbook PDF failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "PDF generation failed" },
      { status: 500 }
    );
  }
}
