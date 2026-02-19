import { NextResponse } from "next/server";
import { verifyPdfPreviewToken } from "@/lib/pdf-preview-token";
import { getPdfPreviewHtml } from "@/app/api/generate-pdf-puppeteer/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/products/[id]/pdf-preview?token=...
 * Returns full HTML for the product PDF preview. Used by the Puppeteer PDF route (page.goto).
 * Auth: short-lived token only (no Clerk; request is from headless browser).
 */
export async function GET(request, { params }) {
  try {
    const resolvedParams = typeof params?.then === "function" ? await params : params;
    const productId = typeof resolvedParams?.id === "string" ? resolvedParams.id.trim() : "";
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token") ?? "";

    if (!productId) {
      return NextResponse.json({ error: "Product ID required" }, { status: 400 });
    }

    const decoded = verifyPdfPreviewToken(productId, token);
    if (!decoded) {
      return NextResponse.json({ error: "Invalid or expired preview link" }, { status: 403 });
    }

    const html = await getPdfPreviewHtml(productId, decoded.userId, {
      includeCover: decoded.includeCover,
      includeBackPage: decoded.includeBackPage,
    });

    if (html == null) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("PDF preview failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Preview failed" },
      { status: 500 }
    );
  }
}
