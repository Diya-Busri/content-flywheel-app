import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const BUCKET = "product-images";

/**
 * POST: Upload a cover-page thumbnail image (base64) and save URL to product marketingAssets.coverThumbnailUrl.
 * Used by the editor when the user is on the cover page and saves, so the library can show the cover thumbnail.
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
      return NextResponse.json(
        { error: "Product ID required" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    let base64 = (body.image as string) ?? "";
    if (base64.startsWith("data:image")) {
      base64 = base64.replace(/^data:image\/\w+;base64,/, "");
    }
    if (!base64) {
      return NextResponse.json(
        { error: "Image data required (base64 or data URL)" },
        { status: 400 }
      );
    }

    const [product] = await db
      .select({ id: productsTable.id, marketingAssets: productsTable.marketingAssets })
      .from(productsTable)
      .where(
        and(
          eq(productsTable.id, productId),
          eq(productsTable.userId, userId),
          isNull(productsTable.deletedAt)
        )
      );

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    const buffer = Buffer.from(base64, "base64");
    const path = `thumbnails/${productId}/cover.png`;
    let url: string;

    const supabase = getSupabaseAdmin();
    if (supabase) {
      let uploadResult = await supabase.storage
        .from(BUCKET)
        .upload(path, buffer, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadResult.error) {
        const errMsg = String(uploadResult.error.message || uploadResult.error).toLowerCase();
        const isBucketMissing =
          errMsg.includes("bucket") ||
          errMsg.includes("not found") ||
          errMsg.includes("does not exist");
        if (isBucketMissing) {
          await supabase.storage.createBucket(BUCKET, { public: true });
          uploadResult = await supabase.storage
            .from(BUCKET)
            .upload(path, buffer, { contentType: "image/png", upsert: true });
        }
      }

      if (!uploadResult.error) {
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
        url = urlData.publicUrl;
      } else {
        url = `data:image/png;base64,${base64}`;
      }
    } else {
      url = `data:image/png;base64,${base64}`;
    }

    const currentAssets = (product.marketingAssets ?? {}) as Record<string, unknown>;
    const updatedAssets = {
      ...currentAssets,
      coverThumbnailUrl: url,
    };

    await db
      .update(productsTable)
      .set({
        marketingAssets: updatedAssets,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(productsTable.id, productId),
          eq(productsTable.userId, userId),
          isNull(productsTable.deletedAt)
        )
      );

    return NextResponse.json({ url });
  } catch (err) {
    console.error("[cover-thumbnail]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Cover thumbnail upload failed",
      },
      { status: 500 }
    );
  }
}
