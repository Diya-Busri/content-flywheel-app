import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productWishlistsTable } from "@/db/schema/product-wishlists-schema";
import { productsTable } from "@/db/schema/products-schema";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq, and, inArray, isNull } from "drizzle-orm";
import type { MarketingAssets } from "@/db/schema/products-schema";

export const dynamic = "force-dynamic";

/** GET /api/marketplace/wishlist — returns the authenticated user's wishlisted product IDs */
export async function GET(_req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ ids: [], items: [] });

  const rows = await db
    .select({ productId: productWishlistsTable.productId })
    .from(productWishlistsTable)
    .where(eq(productWishlistsTable.userId, userId));

  const ids = rows.map((r) => r.productId);

  if (ids.length === 0) return NextResponse.json({ ids: [], items: [] });

  // Fetch full product details for the wishlist page
  const products = await db
    .select({
      id: productsTable.id,
      title: productsTable.title,
      niche: productsTable.niche,
      format: productsTable.format,
      marketingAssets: productsTable.marketingAssets,
      userId: productsTable.userId,
      createdAt: productsTable.createdAt,
    })
    .from(productsTable)
    .where(and(inArray(productsTable.id, ids), isNull(productsTable.deletedAt)));

  // Fetch creator names
  const userIds = Array.from(new Set(products.map((p) => p.userId)));
  const [brandRows, emailRows] = await Promise.all([
    userIds.length > 0
      ? db.select({ userId: brandVoiceTable.userId, brandName: brandVoiceTable.brandName }).from(brandVoiceTable).where(inArray(brandVoiceTable.userId, userIds))
      : [],
    userIds.length > 0
      ? db.select({ userId: profilesTable.userId, email: profilesTable.email }).from(profilesTable).where(inArray(profilesTable.userId, userIds))
      : [],
  ]);

  const brandMap = Object.fromEntries(brandRows.map((r) => [r.userId, r.brandName]));
  const emailMap = Object.fromEntries(emailRows.map((r) => [r.userId, r.email]));

  const items = products.map((p) => {
    const ma = (p.marketingAssets ?? {}) as MarketingAssets;
    const creatorName = brandMap[p.userId]?.trim() || emailMap[p.userId]?.split("@")[0] || "Creator";
    return {
      id: p.id,
      title: p.title,
      niche: p.niche,
      format: p.format,
      priceLabel: ma.priceLabel ?? null,
      nativePrice: ma.nativePrice ?? null,
      thumbnailUrl: ma.coverThumbnailUrl ?? ma.bookMockupUrl ?? ma.thumbnailUrl ?? null,
      description: (ma.productDescription ?? "").slice(0, 160),
      creatorName,
      creatorUserId: p.userId,
      isNativePublished: ma.isNativePublished ?? false,
    };
  });

  return NextResponse.json({ ids, items });
}

/** POST /api/marketplace/wishlist — add a product to wishlist */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { productId } = await req.json().catch(() => ({}));
  if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

  try {
    await db
      .insert(productWishlistsTable)
      .values({ userId, productId })
      .onConflictDoNothing();
  } catch {
    // duplicate — already wishlisted
  }

  return NextResponse.json({ ok: true });
}

/** DELETE /api/marketplace/wishlist?productId=xxx — remove a product from wishlist */
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const productId = new URL(req.url).searchParams.get("productId");
  if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

  await db
    .delete(productWishlistsTable)
    .where(and(eq(productWishlistsTable.userId, userId), eq(productWishlistsTable.productId, productId)));

  return NextResponse.json({ ok: true });
}
