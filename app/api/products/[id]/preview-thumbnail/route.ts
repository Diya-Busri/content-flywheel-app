export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";
import { upload } from "@/lib/storage";

/**
 * POST: Upload a content-page preview screenshot and save URL to marketingAssets.previewPageUrl.
 * Accepts multipart/form-data with a "file" field (JPEG blob).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: productId } = await params;
    if (!productId) return NextResponse.json({ error: "Product ID required" }, { status: 400 });

    const fd = await request.formData();
    const file = fd.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || "image/jpeg";

    const [product] = await db
      .select({ id: productsTable.id, marketingAssets: productsTable.marketingAssets })
      .from(productsTable)
      .where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId), isNull(productsTable.deletedAt)));

    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const ext = contentType === "image/jpeg" ? "jpg" : "png";
    const key = `products/${userId}/thumbnails/${productId}/preview.${ext}`;

    const { url } = await upload(key, buffer, { contentType });

    const updatedAssets = { ...((product.marketingAssets ?? {}) as Record<string, unknown>), previewPageUrl: url };
    await db.update(productsTable)
      .set({ marketingAssets: updatedAssets, updatedAt: new Date() })
      .where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId), isNull(productsTable.deletedAt)));

    return NextResponse.json({ url });
  } catch (err) {
    console.error("[preview-thumbnail]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
