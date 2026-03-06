import { NextResponse } from "next/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";

export const runtime = "nodejs";

const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(req: Request) {
  try {
    const formData = await req.formData().catch(() => null);
    const file = formData?.get("file");
    if (!file || !(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json(
        { error: `File too large. Max ${MAX_PDF_BYTES / 1024 / 1024}MB.` },
        { status: 400 }
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const text = typeof result?.text === "string" ? result.text.trim() : "";
    return NextResponse.json({ text });
  } catch (err) {
    console.error("[extract-pdf-text]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to extract PDF text" },
      { status: 500 }
    );
  }
}
