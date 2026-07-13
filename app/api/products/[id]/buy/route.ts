export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { storeSettingsTable } from "@/db/schema/store-settings-schema";
import { creatorPromoCodesTable } from "@/db/schema/creator-promo-codes-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq, and, isNull } from "drizzle-orm";

// 2% platform fee on sales — transparent on pricing page, still far below competitors
const PLATFORM_FEE_PERCENT = 2;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://contentflywheel.co.uk";

type ExtendedMarketingAssets = {
  isNativePublished?: boolean;
  stripePriceId?: string;
  stripeProductId?: string;
  nativePrice?: number;
  salePrice?: number;
  subscriptionInterval?: "month" | "year" | null;
  stripeSubscriptionPriceId?: string | null;
  isCourseFormat?: boolean;
  payWhatYouWant?: boolean;
  minPrice?: number | null;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params;
  // Parse ref code from query string for affiliate tracking
  const url = new URL(request.url);
  const refCode = url.searchParams.get("ref") ?? null;

  // Check if the buyer is the product owner — Stripe blocks self-purchases
  const { userId: buyerUserId } = await auth();

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

    // Block self-purchases — Stripe rejects transfer_data[destination] pointing to own account
    if (buyerUserId && buyerUserId === product.userId) {
      return NextResponse.json(
        { error: "You can't purchase your own product. Share the link with your customers to test the checkout." },
        { status: 400 }
      );
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

    // Fetch store settings + creator's Stripe Connect account in parallel
    const [[storeSettings], [creatorProfile]] = await Promise.all([
      db
        .select({ vatEnabled: storeSettingsTable.vatEnabled, vatRate: storeSettingsTable.vatRate })
        .from(storeSettingsTable)
        .where(eq(storeSettingsTable.userId, product.userId))
        .limit(1),
      db
        .select({
          stripeConnectAccountId: profilesTable.stripeConnectAccountId,
          stripeConnectChargesEnabled: profilesTable.stripeConnectChargesEnabled,
          membership: profilesTable.membership,
        })
        .from(profilesTable)
        .where(eq(profilesTable.userId, product.userId))
        .limit(1),
    ]);

    const vatEnabled = storeSettings?.vatEnabled ?? false;

    // Require the creator to have Stripe Connect set up before selling
    const connectAccountId = creatorProfile?.stripeConnectAccountId;
    if (!connectAccountId || !creatorProfile?.stripeConnectChargesEnabled) {
      return NextResponse.json(
        { error: "Creator has not set up payouts yet. Please check back soon." },
        { status: 402 }
      );
    }

    const platformFeePercent = PLATFORM_FEE_PERCENT;

    // Ensure the Stripe product is active — it may have been archived during a
    // previous unpublish cycle and the reactivation on re-publish can fail silently.
    if (ma.stripeProductId) {
      await stripe.products.update(ma.stripeProductId, { active: true }).catch((err) => {
        console.warn("[buy] Could not reactivate Stripe product:", err?.message);
      });
    }

    // ── Subscription mode — use Stripe Subscriptions checkout ────────────
    if (ma.subscriptionInterval && ma.stripeSubscriptionPriceId) {
      const subscriptionPriceId = ma.stripeSubscriptionPriceId;
      const subPrice = await stripe.prices.retrieve(subscriptionPriceId);
      const unitAmount = subPrice.unit_amount ?? 0;
      const appFee = platformFeePercent > 0 ? Math.round(unitAmount * (platformFeePercent / 100)) : undefined;

      const subSuccessBase = ma.isCourseFormat ? `${baseUrl}/course/${productId}` : `${baseUrl}/product/${productId}`;
      const subSession = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: subscriptionPriceId, quantity: 1 }],
        success_url: `${subSuccessBase}?purchased=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/product/${productId}`,
        metadata: {
          type: "product_purchase",
          productId: product.id,
          creatorUserId: product.userId,
          vatEnabled: vatEnabled ? "true" : "false",
          ...(refCode ? { affiliateRef: refCode } : {}),
        },
        subscription_data: {
          application_fee_percent: platformFeePercent > 0 ? platformFeePercent : undefined,
          transfer_data: { destination: connectAccountId },
        },
        billing_address_collection: "auto",
        customer_creation: "always",
      });
      return NextResponse.json({ url: subSession.url });
    }

    // ── Pay-what-you-want: buyer supplies a custom amount ─────────────────
    let pwywAmount: number | null = null;
    let bodyForPromo: Record<string, unknown> = {};
    try {
      bodyForPromo = await request.json().catch(() => ({}));
    } catch { /* ok */ }

    if (ma.payWhatYouWant) {
      const raw = typeof bodyForPromo.customAmount === "number" ? bodyForPromo.customAmount : null;
      const minPence = ma.minPrice ?? 0;
      if (raw !== null) {
        if (raw < minPence) {
          return NextResponse.json(
            { error: `Minimum amount is £${(minPence / 100).toFixed(2)}` },
            { status: 400 }
          );
        }
        pwywAmount = raw;
      } else {
        // Fall back to the creator's set price if no custom amount supplied
        pwywAmount = ma.nativePrice ?? minPence;
      }
    }

    // Parse optional promo code from request body
    let promoCode: string | null = null;
    let appliedPromoCodeId: string | null = null;
    let discountedUnitAmount: number | null = null;

    try {
      const rawCode = typeof bodyForPromo?.promoCode === "string" ? bodyForPromo.promoCode.trim() : null;

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

    // Build line items — PWYW overrides everything else
    let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
    let unitAmountForFee: number;

    if (pwywAmount !== null) {
      // Pay-what-you-want: use inline price_data with buyer-supplied amount
      lineItems = [
        {
          price_data: {
            currency: "gbp",
            product_data: { name: product.title },
            unit_amount: pwywAmount,
          },
          quantity: 1,
        },
      ];
      unitAmountForFee = pwywAmount;
    } else if (discountedUnitAmount !== null) {
      const stripePrice = await stripe.prices.retrieve(ma.stripePriceId!);
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
      unitAmountForFee = discountedUnitAmount;
    } else if (typeof ma.salePrice === "number") {
      const stripePrice = await stripe.prices.retrieve(ma.stripePriceId!);
      if (ma.salePrice < (stripePrice.unit_amount ?? 0)) {
        lineItems = [
          {
            price_data: {
              currency: stripePrice.currency,
              product_data: { name: product.title },
              unit_amount: ma.salePrice,
            },
            quantity: 1,
          },
        ];
        unitAmountForFee = ma.salePrice;
      } else {
        lineItems = [{ price: ma.stripePriceId, quantity: 1 }];
        unitAmountForFee = stripePrice.unit_amount ?? 0;
      }
    } else {
      const stripePrice = await stripe.prices.retrieve(ma.stripePriceId!);
      lineItems = [{ price: ma.stripePriceId, quantity: 1 }];
      unitAmountForFee = stripePrice.unit_amount ?? 0;
    }

    const applicationFeeAmount =
      platformFeePercent > 0 ? Math.round(unitAmountForFee * (platformFeePercent / 100)) : undefined;

    // Free (£0) items: Stripe doesn't create a PaymentIntent for zero-amount
    // Checkout Sessions (nothing to charge, nothing to transfer), so omitting
    // payment_intent_data avoids Stripe rejecting a PI config with no PI.
    const isFreeCheckout = unitAmountForFee === 0;

    // Build checkout session params — route payment through creator's connected account
    const successBase = ma.isCourseFormat ? `${baseUrl}/course/${productId}` : `${baseUrl}/product/${productId}`;
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      line_items: lineItems,
      success_url: `${successBase}?purchased=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/product/${productId}`,
      metadata: {
        type: "product_purchase",
        productId: product.id,
        creatorUserId: product.userId,
        vatEnabled: vatEnabled ? "true" : "false",
        ...(promoCode ? { promoCode } : {}),
        ...(appliedPromoCodeId ? { promoCodeId: appliedPromoCodeId } : {}),
        ...(refCode ? { affiliateRef: refCode } : {}),
      },
      // Only allow Stripe promotion codes when no native promo code was applied
      allow_promotion_codes: discountedUnitAmount === null,
      billing_address_collection: "auto",
      customer_creation: "always",
      // Route money to the creator's Stripe account (skipped for £0 — no PaymentIntent is created)
      ...(isFreeCheckout
        ? {}
        : {
            payment_intent_data: {
              application_fee_amount: applicationFeeAmount,
              transfer_data: { destination: connectAccountId },
            },
          }),
    };

    // If VAT is enabled, collect tax IDs and note that price is VAT-inclusive
    if (vatEnabled) {
      sessionParams.tax_id_collection = { enabled: true };
    }

    // Create the session on the platform account — destination charge routes payment to creator
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
