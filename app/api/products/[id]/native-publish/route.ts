import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";
import type { MarketingAssets } from "@/db/schema/products-schema";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params;

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const price = body.price;
    if (typeof price !== "number" || price < 100) {
      return NextResponse.json(
        { error: "Invalid price. Minimum is 100 pence (£1.00)." },
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
      )
      .limit(1);

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const existing = (product.marketingAssets ?? {}) as MarketingAssets & {
      nativePrice?: number;
      stripePriceId?: string;
      stripeProductId?: string;
      isNativePublished?: boolean;
    };

    // Create or reuse Stripe product
    let stripeProductId = existing.stripeProductId;
    if (!stripeProductId) {
      const stripeProduct = await stripe.products.create({
        name: product.title,
        metadata: {
          productId: product.id,
          creatorUserId: userId,
        },
      });
      stripeProductId = stripeProduct.id;
    } else {
      // Update product name in case title changed
      await stripe.products.update(stripeProductId, { name: product.title }).catch(() => {});
    }

    // Always create a new price (Stripe prices are immutable)
    const stripePrice = await stripe.prices.create({
      product: stripeProductId,
      unit_amount: price,
      currency: "gbp",
    });

    // Archive old price if there was one
    if (existing.stripePriceId && existing.stripePriceId !== stripePrice.id) {
      await stripe.prices.update(existing.stripePriceId, { active: false }).catch(() => {});
    }

    const priceLabel = `£${(price / 100).toFixed(2)}`;

    const updatedAssets: MarketingAssets & {
      nativePrice: number;
      stripePriceId: string;
      stripeProductId: string;
      isNativePublished: boolean;
    } = {
      ...existing,
      nativePrice: price,
      stripePriceId: stripePrice.id,
      stripeProductId,
      isNativePublished: true,
      priceLabel,
    };

    await db
      .update(productsTable)
      .set({ marketingAssets: updatedAssets, updatedAt: new Date() })
      .where(eq(productsTable.id, productId));

    return NextResponse.json({ success: true, priceLabel });
  } catch (err) {
    console.error("[native-publish] POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to publish" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params;

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      )
      .limit(1);

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const existing = (product.marketingAssets ?? {}) as MarketingAssets & {
      isNativePublished?: boolean;
      stripeProductId?: string;
      stripePriceId?: string;
    };

    // Archive the Stripe price when unpublishing
    if (existing.stripePriceId) {
      await stripe.prices.update(existing.stripePriceId, { active: false }).catch(() => {});
    }
    if (existing.stripeProductId) {
      await stripe.products.update(existing.stripeProductId, { active: false }).catch(() => {});
    }

    const updatedAssets = {
      ...existing,
      isNativePublished: false,
    };

    await db
      .update(productsTable)
      .set({ marketingAssets: updatedAssets, updatedAt: new Date() })
      .where(eq(productsTable.id, productId));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[native-publish] DELETE error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to unpublish" },
      { status: 500 }
    );
  }
}
