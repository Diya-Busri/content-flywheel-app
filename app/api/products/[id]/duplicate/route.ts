import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * POST /api/products/[id]/duplicate
 * Creates a full copy of a product (content, design, marketing assets).
 * Returns { id: string } — the new product's ID.
 *
 * Notes:
 * - promoVideoUrl / promoVideoId / promoVideoStatus are NOT copied (video is expensive/ephemeral).
 * - thumbnailUrl / coverThumbnailUrl / bookMockupUrl ARE copied (static images persist).
 * - Title gets " (Copy)" appended.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: productId } = await params;
    if (!productId) return NextResponse.json({ error: "Product ID required" }, { status: 400 });

    const [original] = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId), isNull(productsTable.deletedAt)));

    if (!original) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    // Build cloned marketing assets — strip ephemeral video state
    const originalMa = (original.marketingAssets ?? {}) as Record<string, unknown>;
    const clonedMa = {
      ...originalMa,
      promoVideoUrl: null,
      promoVideoId: null,
      promoVideoStatus: null,
      promoVideoProvider: null,
      updatedAt: new Date().toISOString(),
    };

    const [newProduct] = await db
      .insert(productsTable)
      .values({
        userId,
        title: `${original.title} (Copy)`,
        niche: original.niche,
        format: original.format,
        content: original.content,
        designSettings: original.designSettings ?? undefined,
        placedElements: original.placedElements ?? undefined,
        customizationOptions: original.customizationOptions ?? undefined,
        marketingAssets: clonedMa,
        status: "draft",
        generationStatus: original.generationStatus ?? undefined,
        designSource: original.designSource ?? null,
        // bundleId intentionally omitted — copy is standalone
      })
      .returning({ id: productsTable.id });

    if (!newProduct) {
      return NextResponse.json({ error: "Failed to create duplicate" }, { status: 500 });
    }

    return NextResponse.json({ id: newProduct.id });
  } catch (err) {
    console.error("[product/duplicate]", err);
    return NextResponse.json({ error: "Failed to duplicate product" }, { status: 500 });
  }
}
