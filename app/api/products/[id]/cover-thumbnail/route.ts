import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const BUCKET = "product-images";

/**
 * POST: Upload a cover-page thumbnail (multipart/form-data) and save URL to marketingAssets.coverThumbnailUrl.
 * Accepts a "file" field (JPEG blob). Using FormData avoids JSON body size limits.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: productId } = await params;
    if (!productId) {
      return NextResponse.json({ error: "Product ID required" }, { status: 400 });
    }

    // Support both FormData (preferred) and legacy JSON base64
    let buffer: Buffer;
    let contentType = "image/jpeg";
    const ct = request.headers.get("content-type") ?? "";

    if (ct.includes("multipart/form-data")) {
      const fd = await request.formData();
      const file = fd.get("file") as File | null;
      if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
      buffer = Buffer.from(await file.arrayBuffer());
      contentType = file.type || "image/jpeg";
    } else {
      // Legacy JSON base64 path
      const body = await request.json().catch(() => ({}));
      let base64 = (body.image as string) ?? "";
      if (base64.startsWith("data:image")) {
        const match = base64.match(/^data:(image\/\w+);base64,/);
        if (match) contentType = match[1];
        base64 = base64.replace(/^data:image\/\w+;base64,/, "");
      }
      if (!base64) return NextResponse.json({ error: "Image data required" }, { status: 400 });
      buffer = Buffer.from(base64, "base64");
    }

    const [product] = await db
      .select({ id: productsTable.id, marketingAssets: productsTable.marketingAssets })
      .from(productsTable)
      .where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId), isNull(productsTable.deletedAt)));

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const ext = contentType === "image/jpeg" ? "jpg" : "png";
    const path = `thumbnails/${productId}/cover.${ext}`;

    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ error: "Storage not configured" }, { status: 503 });

    let uploadResult = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType, upsert: true });

    if (uploadResult.error) {
      const errMsg = String(uploadResult.error.message || uploadResult.error).toLowerCase();
      if (errMsg.includes("bucket") || errMsg.includes("not found") || errMsg.includes("does not exist")) {
        await supabase.storage.createBucket(BUCKET, { public: true });
        uploadResult = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType, upsert: true });
      }
    }

    if (uploadResult.error) {
      console.error("[cover-thumbnail] Supabase upload failed:", uploadResult.error);
      return NextResponse.json({ error: "Failed to upload thumbnail to storage" }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const url = urlData.publicUrl;

    const updatedAssets = { ...((product.marketingAssets ?? {}) as Record<string, unknown>), coverThumbnailUrl: url };
    await db.update(productsTable)
      .set({ marketingAssets: updatedAssets, updatedAt: new Date() })
      .where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId), isNull(productsTable.deletedAt)));

    return NextResponse.json({ url });
  } catch (err) {
    console.error("[cover-thumbnail]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Cover thumbnail upload failed" }, { status: 500 });
  }
}
