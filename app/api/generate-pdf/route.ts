import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/generate-pdf
 * Accepts { html, fileName } and converts to PDF via PDFShift API.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;

    const body = await request.json().catch(() => ({}));
    const html = typeof body.html === "string" ? body.html : "";
    const fileName = typeof body.fileName === "string" ? body.fileName : "document.pdf";

    if (!html) {
      return NextResponse.json({ error: "Missing html in request body" }, { status: 400 });
    }

    const MAX_HTML_BYTES = 2 * 1024 * 1024;
    const htmlSize = Buffer.byteLength(html, "utf8");
    if (htmlSize > MAX_HTML_BYTES) {
      return NextResponse.json(
        {
          error: `HTML is too large (${Math.round(htmlSize / 1024)}KB). Remove background images or large embedded images to stay under 2MB.`,
        },
        { status: 413 }
      );
    }

    const apiKey = process.env.PDFSHIFT_API_KEY;
    if (!apiKey) {
      console.error("PDFSHIFT_API_KEY is not set");
      return NextResponse.json({ error: "PDF generation is not configured" }, { status: 500 });
    }

    const credentials = Buffer.from(`api:${apiKey}`).toString("base64");
    const response = await fetch("https://api.pdfshift.io/v3/convert/pdf", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: html,
        landscape: false,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("PDFShift API error:", response.status, errText);
      return NextResponse.json(
        { error: errText || `PDF conversion failed (${response.status})` },
        { status: response.status >= 400 && response.status < 500 ? response.status : 500 }
      );
    }

    const pdfBuffer = Buffer.from(await response.arrayBuffer());
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 200) || "document.pdf";

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeFileName}"`,
      },
    });
  } catch (err) {
    console.error("Generate PDF failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "PDF generation failed" },
      { status: 500 }
    );
  }
}
