import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { storeSettingsTable } from "@/db/schema/store-settings-schema";
import { creatorPromoCodesTable } from "@/db/schema/creator-promo-codes-schema";
import { eq, and, isNull } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://contentflywheel.co.uk";

type ExtendedMarketingAssets = {
  isNativePublished?: boolean;
  stripePriceId?: string;
  nativePrice?: number;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params;

  try {
    const [product] = await db
      .select({
        id: productsTable.id,
        title: productsTable.title,
        userId: productsTable.userId,
        marketingAssets: productsTable.marketingAssets,
      })
      .from(productsTable)
      .where(and(eq(productsTable.id, productId), isNull(productsTable.deletedAt)))
      .limit(1);

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const ma = (product.marketingAssets ?? {}) as ExtendedMarketingAssets;

    if (!ma.isNativePublished) {
      return NextResponse.json(
        { error: "This product is not available for purchase" },
        { status: 400 }
      );
    }

    if (!ma.stripePriceId) {
      return NextResponse.json(
        { error: "Product is not configured for purchase" },
        { status: 400 }
      );
    }

    // Fetch store settings to check VAT
    const [storeSettings] = await db
      .select({
        vatEnabled: storeSettingsTable.vatEnabled,
        vatRate: storeSettingsTable.vatRate,
      })
      .from(storeSettingsTable)
      .where(eq(storeSettingsTable.userId, product.userId))
      .limit(1);

    const vatEnabled = storeSettings?.vatEnabled ?? false;

    // Parse optional promo code from request body
    let promoCode: string | null = null;
    let appliedPromoCodeId: string | null = null;
    let discountedUnitAmount: number | null = null;

    try {
      const body = await request.json().catch(() => ({}));
      const rawCode = typeof body?.promoCode === "string" ? body.promoCode.trim() : null;

      if (rawCode) {
        // Validate the promo code
        const [promo] = await db
          .select()
          .from(creatorPromoCodesTable)
          .where(
            and(
              eq(creatorPromoCodesTable.creatorUserId, product.userId),
              eq(creatorPromoCodesTable.code, rawCode.toUpperCase()),
              eq(creatorPromoCodesTable.active, true)
            )
          )
          .limit(1);

        if (promo) {
          const now = new Date();
          const expired = promo.expiresAt && promo.expiresAt < now;
          const exhausted = promo.maxUses !== null && promo.usedCount >= promo.maxUses;

          if (!expired && !exhausted) {
            // Fetch the base price from Stripe to calculate discount
            const stripePrice = await stripe.prices.retrieve(ma.stripePriceId);
            const baseAmount = stripePrice.unit_amount ?? 0;

            if (promo.discountPercent) {
              discountedUnitAmount = Math.max(0, Math.round(baseAmount * (1 - promo.discountPercent / 100)));
            } else if (promo.discountAmount) {
              discountedUnitAmount = Math.max(0, baseAmount - promo.discountAmount);
            }

            promoCode = promo.code;
            appliedPromoCodeId = promo.id;
          }
        }
      }
    } catch {
      // If body parse or promo lookup fails, proceed without discount
    }

    // Build line items — use inline price if a discount was applied
    let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
    if (discountedUnitAmount !== null) {
      // Fetch currency from the original Stripe price
      const stripePrice = await stripe.prices.retrieve(ma.stripePriceId);
      lineItems = [
        {
          price_data: {
            currency: stripePrice.currency,
            product_data: { name: product.title },
            unit_amount: discountedUnitAmount,
          },
          quantity: 1,
        },
      ];
    } else {
      lineItems = [{ price: ma.stripePriceId, quantity: 1 }];
    }

    // Build checkout session params
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      line_items: lineItems,
      success_url: `${baseUrl}/product/${productId}?purchased=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/product/${productId}`,
      metadata: {
        type: "product_purchase",
        productId: product.id,
        creatorUserId: product.userId,
        vatEnabled: vatEnabled ? "true" : "false",
        ...(promoCode ? { promoCode } : {}),
        ...(appliedPromoCodeId ? { promoCodeId: appliedPromoCodeId } : {}),
      },
      // Only allow Stripe promotion codes when no native promo code was applied
      allow_promotion_codes: discountedUnitAmount === null,
      billing_address_collection: "auto",
      customer_creation: "always",
    };

    // If VAT is enabled, collect tax IDs and note that price is VAT-inclusive
    if (vatEnabled) {
      sessionParams.tax_id_collection = { enabled: true };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[buy] POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
