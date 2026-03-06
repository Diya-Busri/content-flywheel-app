import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";
import {
  generateHtmlThumbnail,
  type ThumbnailStyleId,
} from "@/lib/thumbnail-html";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_STYLES: ThumbnailStyleId[] = [
  "modern-gradient",
  "clean-minimal",
  "bold-dark",
  "lifestyle",
];

const BUCKET = "product-images";

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
    const style = (body.style as ThumbnailStyleId) ?? "modern-gradient";
    if (!VALID_STYLES.includes(style)) {
      return NextResponse.json(
        { error: "Invalid style" },
        { status: 400 }
      );
    }

    const [product] = await db
      .select()
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

    const { buffer } = await generateHtmlThumbnail(
      {
        title: product.title,
        niche: product.niche,
        format: product.format,
      },
      style
    );

    let url: string;
    let cached = false;
    const supabase = getSupabaseAdmin();
    const path = `thumbnails/${productId}/thumbnail.png`;

    const bufferBytes = Buffer.from(buffer);
    if (supabase) {
      let uploadResult = await supabase.storage
        .from(BUCKET)
        .upload(path, bufferBytes, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadResult.error) {
        const errMsg = String(uploadResult.error.message || uploadResult.error).toLowerCase();
        const isBucketMissing = errMsg.includes("bucket") || errMsg.includes("not found") || errMsg.includes("does not exist");
        if (isBucketMissing) {
          const { error: createErr } = await supabase.storage.createBucket(BUCKET, { public: true });
          if (!createErr) {
            uploadResult = await supabase.storage
              .from(BUCKET)
              .upload(path, bufferBytes, { contentType: "image/png", upsert: true });
          }
        }
      }

      if (!uploadResult.error) {
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
        url = urlData.publicUrl;
        cached = true;
      } else {
        url = `data:image/png;base64,${bufferBytes.toString("base64")}`;
      }
    } else {
      url = `data:image/png;base64,${bufferBytes.toString("base64")}`;
    }

    const currentAssets = (product.marketingAssets ?? {}) as Record<
      string,
      unknown
    >;
    const updatedAssets = {
      ...currentAssets,
      thumbnailUrl: url,
      thumbnailStyle: style,
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

    return NextResponse.json({ url, style, cached });
  } catch (err) {
    console.error("[generate-thumbnail]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Thumbnail generation failed",
      },
      { status: 500 }
    );
  }
}
