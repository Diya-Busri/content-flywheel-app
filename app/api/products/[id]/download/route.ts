import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { productOrdersTable } from "@/db/schema/product-orders-schema";
import { eq, and } from "drizzle-orm";

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]/g, "-").replace(/-+/g, "-").slice(0, 100) || "product";
}

/** Map product format to generator format. */
function resolveFormat(format: string): string {
  const map: Record<string, string> = {
    guide: "ebook",
    journal: "ebook",
    planner: "ebook",
    cookbook: "ebook",
    notion: "notion",
    spreadsheet: "spreadsheet",
    ebook: "ebook",
    workbook: "workbook",
    checklist: "checklist",
    course: "ebook",
  };
  return map[format] ?? "ebook";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params;
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing download token" }, { status: 400 });
  }

  try {
    // Validate the order token
    const [order] = await db
      .select()
      .from(productOrdersTable)
      .where(
        and(
          eq(productOrdersTable.downloadToken, token),
          eq(productOrdersTable.productId, productId),
          eq(productOrdersTable.status, "completed")
        )
      )
      .limit(1);

    if (!order) {
      return NextResponse.json({ error: "Invalid or expired download link" }, { status: 403 });
    }

    if (order.accessRevokedAt) {
      return NextResponse.json({ error: "Access to this download has been revoked following a refund." }, { status: 403 });
    }

    if (order.downloadExpiresAt && order.downloadExpiresAt < new Date()) {
      return NextResponse.json({ error: "Download link has expired" }, { status: 403 });
    }

    // Record the first time this order's file is actually fetched (best-effort, never blocks delivery).
    if (!order.firstDownloadAt) {
      db.update(productOrdersTable)
        .set({ firstDownloadAt: new Date() })
        .where(eq(productOrdersTable.id, order.id))
        .catch((err) => console.warn("[download] Failed to record firstDownloadAt:", err));
    }

    // Fetch the product
    const [product] = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .limit(1);

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const ma = (product.marketingAssets ?? {}) as {
      uploadedFileUrl?: string | null;
      uploadedFileName?: string | null;
    };

    // ── Uploaded product: proxy the original file ──────────────────────────
    if (ma.uploadedFileUrl) {
      const fileRes = await fetch(ma.uploadedFileUrl);
      if (!fileRes.ok) {
        return NextResponse.json({ error: "Could not retrieve product file" }, { status: 502 });
      }
      const contentType = fileRes.headers.get("content-type") ?? "application/octet-stream";
      const rawName = ma.uploadedFileName ?? "product";
      const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 100);
      return new NextResponse(fileRes.body, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${safeName}"`,
        },
      });
    }

    const content = product.content as {
      sections?: Array<{ id: string; title: string; content: string; order: number; imageUrl?: string }>;
    };
    const sections = (content?.sections ?? []).map((s) => ({
      title: s.title,
      body: s.content ?? "",
    }));

    const format = product.format ?? "ebook";
    const resolvedFormat = resolveFormat(format);
    const title = product.title;

    // Notion: return as markdown text file
    if (resolvedFormat === "notion") {
      const { generateProduct } = await import("@/lib/generators");
      const result = await generateProduct("notion", {
        title,
        description: "",
        niche: product.niche ?? "",
        sections,
      }) as { markdown: string; csv: string; instructions: string };

      const combined = `# ${title}\n\n${result.markdown}\n\n---\n\nImport Instructions:\n${result.instructions}`;
      const encoder = new TextEncoder();
      const bytes = encoder.encode(combined);

      return new NextResponse(bytes, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${sanitizeFilename(title)}.txt"`,
          "Content-Length": String(bytes.byteLength),
        },
      });
    }

    // Spreadsheet: generate XLSX
    if (resolvedFormat === "spreadsheet") {
      const { generateProduct } = await import("@/lib/generators");
      const buffer = await generateProduct("spreadsheet", {
        title,
        description: "",
        niche: product.niche ?? "",
        sections,
      }) as ArrayBuffer;

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${sanitizeFilename(title)}.xlsx"`,
        },
      });
    }

    // All other formats: generate PDF using ebook generator (which uses actual section content)
    const { generateEbook } = await import("@/lib/generators/ebook");
    const buffer = await generateEbook({
      title,
      description: "",
      niche: product.niche ?? "",
      sections,
      designSettings: (product.designSettings as Record<string, unknown>) ?? undefined,
      placedElementsByPage: (product.placedElements as any[][] | null) ?? undefined,
    }) as ArrayBuffer;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${sanitizeFilename(title)}.pdf"`,
      },
    });
  } catch (err) {
    console.error("[download] GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Download failed" },
      { status: 500 }
    );
  }
}
