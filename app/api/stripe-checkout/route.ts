export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import Stripe from "stripe";
import { db } from "@/db/db";
import { promoCodesTable } from "@/db/schema/promo-codes-schema";
import { eq, and } from "drizzle-orm";

/** Production domain for Stripe success/cancel redirects. Never use Vercel preview URLs. */
const PRODUCTION_DOMAIN = "https://contentflywheel.co.uk";
function getStripeRedirectBase(): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (env && env.startsWith("https://contentflywheel.co.uk")) return env.replace(/\/$/, "");
  return PRODUCTION_DOMAIN;
}

/**
 * Finds or creates a Stripe coupon for the given promo code.
 * Uses id = "CF_<CODE>" as a stable identifier so we never duplicate.
 */
async function getOrCreateStripeCoupon(
  stripe: Stripe,
  promo: { code: string; discountPercent: number; discountAmount: number }
): Promise<string> {
  const couponId = `CF_${promo.code}`;
  try {
    const existing = await stripe.coupons.retrieve(couponId);
    return existing.id;
  } catch {
    // Coupon doesn't exist — create it
    const base: Stripe.CouponCreateParams = {
      id: couponId,
      name: promo.code,
      duration: "forever",
    };
    if (promo.discountPercent > 0) {
      base.percent_off = promo.discountPercent;
    } else if (promo.discountAmount > 0) {
      base.amount_off = promo.discountAmount;
      base.currency = "gbp";
    }
    const coupon = await stripe.coupons.create(base);
    return coupon.id;
  }
}

/**
 * POST /api/stripe-checkout
 * Body: { plan: "monthly" | "yearly", promoCode?: string }
 * Creates a Stripe Checkout Session (subscription) and returns the session URL.
 */
export async function POST(request: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const monthlyPriceId = process.env.STRIPE_MONTHLY_PRICE_ID?.trim();
  const yearlyPriceId = process.env.STRIPE_YEARLY_PRICE_ID?.trim();

  if (!secretKey || !monthlyPriceId || !yearlyPriceId) {
    return NextResponse.json(
      { error: "Payment system error. Please try again later." },
      { status: 500 }
    );
  }

  if (!secretKey.startsWith("sk_test_") && !secretKey.startsWith("sk_live_")) {
    console.warn("[Stripe checkout] STRIPE_SECRET_KEY has unexpected prefix");
    return NextResponse.json(
      { error: "Payment system error. Please try again later." },
      { status: 500 }
    );
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { priceId?: string; plan?: "monthly" | "yearly"; promoCode?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let priceId: string;
  if (body.plan === "monthly") priceId = monthlyPriceId;
  else if (body.plan === "yearly") priceId = yearlyPriceId;
  else if (body.priceId && [monthlyPriceId, yearlyPriceId].includes(body.priceId.trim())) priceId = body.priceId.trim();
  else {
    return NextResponse.json(
      { error: "Provide plan: 'monthly' | 'yearly' or a valid priceId." },
      { status: 400 }
    );
  }
  priceId = priceId.trim();
  const resolvedPlan: "monthly" | "yearly" =
    body.plan === "yearly" ? "yearly" : "monthly";

  const baseUrl = getStripeRedirectBase();
  const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });

  // --- Promo code handling ---
  let sessionExtras: Partial<Stripe.Checkout.SessionCreateParams> = {
    allow_promotion_codes: true,
  };

  if (body.promoCode) {
    const code = body.promoCode.trim().toUpperCase();
    const now = new Date();

    const [promo] = await db
      .select()
      .from(promoCodesTable)
      .where(and(eq(promoCodesTable.code, code), eq(promoCodesTable.active, true)));

    if (!promo) {
      return NextResponse.json({ error: "Invalid or expired promo code." }, { status: 400 });
    }
    if (promo.expiresAt && promo.expiresAt < now) {
      return NextResponse.json({ error: "This promo code has expired." }, { status: 400 });
    }
    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
      return NextResponse.json({ error: "This promo code has reached its usage limit." }, { status: 400 });
    }
    if (promo.plan !== "both" && promo.plan !== resolvedPlan) {
      return NextResponse.json(
        { error: `This code is only valid for the ${promo.plan} plan.` },
        { status: 400 }
      );
    }

    try {
      const couponId = await getOrCreateStripeCoupon(stripe, promo);
      // When applying a coupon directly, can't also use allow_promotion_codes
      sessionExtras = {
        discounts: [{ coupon: couponId }],
      };
    } catch (err) {
      console.error("[stripe-checkout] Failed to create coupon:", err);
      // Don't block checkout if coupon creation fails — fall back to no discount
    }
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing`,
      client_reference_id: userId,
      subscription_data: {
        trial_period_days: 7,
      },
      metadata: {
        promoCode: body.promoCode?.trim().toUpperCase() || "",
        userId,
      },
      ...sessionExtras,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Payment system error. Please try again later." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payment system error. Please try again later.";
    console.error("[stripe-checkout] Stripe error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
