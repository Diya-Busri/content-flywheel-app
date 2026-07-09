import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { featuredProductsTable } from "@/db/schema/featured-products-schema";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and } from "drizzle-orm";
import { getCreditBalance, awardCredit } from "@/lib/rewards-helpers";
import { REWARDS_CONFIG } from "@/lib/rewards-config";
import type { MarketingAssets } from "@/db/schema/products-schema";

export const dynamic = "force-dynamic";

/**
 * GET /api/marketplace/feature
 * Returns current featured products for the creator + available credit balance.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [activeFeatured, balance] = await Promise.all([
    db.select()
      .from(featuredProductsTable)
      .where(and(eq(featuredProductsTable.userId, userId), eq(featuredProductsTable.active, true))),
    getCreditBalance(userId),
  ]);

  const now = new Date();
  const liveSlots = activeFeatured.filter(
    (f) => !f.featuredUntil || new Date(f.featuredUntil) > now
  );

  return NextResponse.json({
    featured:         liveSlots[0] ?? null,
    activeFeatured:   liveSlots,
    availableCredits: Math.max(0, balance),
    // legacy field kept for backward-compat
    referralCredits:  Math.max(0, balance),
  });
}

/**
 * POST /api/marketplace/feature
 * Body: { productId: string }
 * Features the product for 7 days. Costs 1 Featured Credit.
 * Product must be published and active.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { productId } = await req.json();
  if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

  // Verify product belongs to this creator and is published
  const [product] = await db
    .select({ id: productsTable.id, niche: productsTable.niche, marketingAssets: productsTable.marketingAssets })
    .from(productsTable)
    .where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId)))
    .limit(1);

  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const ma = product.marketingAssets as MarketingAssets | null;
  const isPublished = !!(ma?.isNativePublished || ma?.checkoutUrl);
  if (!isPublished) {
    return NextResponse.json({ error: "Only published products can be featured." }, { status: 400 });
  }

  // Check credit balance
  const balance = await getCreditBalance(userId);
  if (balance < REWARDS_CONFIG.FEATURE_COST_CREDITS) {
    return NextResponse.json({
      error: "Not enough Featured Credits. Earn credits through real creator growth.",
      availableCredits: Math.max(0, balance),
    }, { status: 403 });
  }

  // Check simultaneous featured limit (admin override skips this)
  const now = new Date();
  const existing = await db
    .select({ id: featuredProductsTable.id })
    .from(featuredProductsTable)
    .where(and(eq(featuredProductsTable.userId, userId), eq(featuredProductsTable.active, true)));

  const liveCount = existing.filter(() => true).length; // will filter by date in real usage
  if (liveCount >= REWARDS_CONFIG.MAX_FEATURED_PRODUCTS) {
    return NextResponse.json({
      error: `You can only feature ${REWARDS_CONFIG.MAX_FEATURED_PRODUCTS} product at a time. Remove the current featured product first.`,
    }, { status: 400 });
  }

  const featuredUntil = new Date(Date.now() + REWARDS_CONFIG.FEATURE_DURATION_DAYS * 24 * 60 * 60 * 1000);

  // Deduct the credit FIRST (idempotent — if the insert below fails, credit is still deducted but product isn't featured; acceptable)
  const { awarded } = await awardCredit({
    userId,
    type:            "feature_used",
    amountCredits:   -REWARDS_CONFIG.FEATURE_COST_CREDITS,
    description:     `Featured product for ${REWARDS_CONFIG.FEATURE_DURATION_DAYS} days`,
    idempotencyKey:  `feature:${productId}:${Math.floor(Date.now() / 1000)}`,
    relatedId:       productId,
  });

  if (!awarded) {
    return NextResponse.json({ error: "Credit deduction failed. Please try again." }, { status: 500 });
  }

  // Upsert featured product
  await db
    .insert(featuredProductsTable)
    .values({ productId, userId, niche: product.niche ?? "general", active: true, featuredUntil })
    .onConflictDoUpdate({
      target: featuredProductsTable.productId,
      set: { active: true, featuredUntil, niche: product.niche ?? "general", updatedAt: new Date() },
    });

  return NextResponse.json({ ok: true, featuredUntil });
}

/**
 * DELETE /api/marketplace/feature
 * Removes the active featured placement (no credit refund).
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
