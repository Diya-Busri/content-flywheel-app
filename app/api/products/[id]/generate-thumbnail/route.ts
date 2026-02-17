import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";
import {
  generateThumbnail,
  type ThumbnailStyleId,
} from "@/lib/thumbnail-dalle";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_STYLES: ThumbnailStyleId[] = [
  "modern-gradient",
  "clean-minimal",
  "bold-dark",
  "lifestyle",
];

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

    const { url, cached } = await generateThumbnail(
      productId,
      {
        title: product.title,
        niche: product.niche,
        format: product.format,
      },
      style
    );

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
