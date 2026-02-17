import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";

const VALID_FORMATS = ["ebook", "guide", "workbook", "spreadsheet", "notion", "course", "checklist", "journal", "planner", "template"] as const;

/**
 * POST: Create product in "generating" state, trigger async processing, return productId immediately.
 * Client should poll GET /api/products/[id] until status === "draft" and content.sections.length > 0.
 */
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
    const nicheName = typeof niche === "string" ? niche : (niche as { name?: string })?.name ?? "";
    const format = VALID_FORMATS.includes(body.format) ? body.format : "ebook";

    if (!productName) {
      return NextResponse.json({ error: "product name is required" }, { status: 400 });
    }

    const designSettings: Record<string, unknown> = {
      template: "modern",
      colors: { primary: "#FF6B35", secondary: "#004E89", accent: "#F7B32B" },
      typography: { heading: "Inter", body: "Open Sans", size: 16 },
    };
    const customizationOptions =
      body.customizationOptions != null && typeof body.customizationOptions === "object"
        ? (body.customizationOptions as Record<string, unknown>)
        : undefined;

    const [inserted] = await db
      .insert(productsTable)
      .values({
        userId,
        title: productName,
        niche: nicheName,
        format,
        content: { sections: [] },
        designSettings,
        placedElements: [],
        customizationOptions: customizationOptions ?? null,
        status: "generating",
      })
      .returning({ id: productsTable.id });

    if (!inserted?.id) {
      return NextResponse.json({ error: "Failed to save product" }, { status: 500 });
    }

    const base =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      (typeof request.url === "string" ? new URL(request.url).origin : null) ||
      "http://localhost:3000";
    fetch(`${base}/api/products/${inserted.id}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch((e) => {
      console.error("[products/create] Failed to trigger process:", e);
    });

    return NextResponse.json({ productId: inserted.id, success: true });
  } catch (err) {
    console.error("Product create failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create product" },
      { status: 500 }
    );
  }
}
