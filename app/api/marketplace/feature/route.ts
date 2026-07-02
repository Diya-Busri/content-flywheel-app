import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { featuredProductsTable } from "@/db/schema/featured-products-schema";
import { productsTable } from "@/db/schema/products-schema";
import { referralsTable } from "@/db/schema/referrals-schema";
import { eq, and, count } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/marketplace/feature
 * Returns current featured product for the authenticated creator + referral credits
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [featured] = await db
    .select()
    .from(featuredProductsTable)
    .where(and(eq(featuredProductsTable.userId, userId), eq(featuredProductsTable.active, true)))
    .limit(1);

  // Count accepted referrals (each = 1 week of featured placement)
  const [{ value: referralCount }] = await db
    .select({ value: count() })
    .from(referralsTable)
    .where(eq(referralsTable.referrerId, userId));

  return NextResponse.json({
    featured: featured ?? null,
    referralCredits: Number(referralCount),
  });
}

/**
 * POST /api/marketplace/feature
 * Body: { productId: string }
 * Features the product (costs 1 referral credit, gives 7 days of placement)
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { productId } = await req.json();
  if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

  // Verify product belongs to this creator
  const [product] = await db
    .select({ id: productsTable.id, niche: productsTable.niche })
    .from(productsTable)
    .where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId)))
    .limit(1);

  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  // Check referral credits
  const [{ value: referralCount }] = await db
    .select({ value: count() })
    .from(referralsTable)
    .where(eq(referralsTable.referrerId, userId));

  if (Number(referralCount) < 1) {
    return NextResponse.json({ error: "Not enough referral credits. Refer a creator to earn featured placement." }, { status: 403 });
  }

  const featuredUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Upsert: one featured product per creator
  await db
    .insert(featuredProductsTable)
    .values({
      productId,
      userId,
      niche: product.niche,
      active: true,
      featuredUntil,
    })
    .onConflictDoUpdate({
      target: featuredProductsTable.productId,
      set: {
        active: true,
        featuredUntil,
        niche: product.niche,
        updatedAt: new Date(),
      },
    });

  // Also deactivate any other featured products by this creator
  await db
    .update(featuredProductsTable)
    .set({ active: false, updatedAt: new Date() })
    .where(and(eq(featuredProductsTable.userId, userId), eq(featuredProductsTable.productId, productId)));

  // Re-activate the correct one
  await db
    .update(featuredProductsTable)
    .set({ active: true, updatedAt: new Date() })
    .where(eq(featuredProductsTable.productId, productId));

  return NextResponse.json({ ok: true, featuredUntil });
}

/**
 * DELETE /api/marketplace/feature
 * Removes featured placement
 */
export async function DELETE() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db
    .update(featuredProductsTable)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(featuredProductsTable.userId, userId));

  return NextResponse.json({ ok: true });
}
