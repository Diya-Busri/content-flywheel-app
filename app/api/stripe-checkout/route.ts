import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";

/**
 * POST /api/stripe-checkout
 * Body: { priceId: string }
 * Creates a Stripe Checkout Session (subscription) and returns the session URL.
 * success_url: /dashboard?session_id={CHECKOUT_SESSION_ID}, cancel_url: /pricing
 * Use STRIPE_MONTHLY_PRICE_ID or STRIPE_YEARLY_PRICE_ID as priceId.
 */
export async function POST(request: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const monthlyPriceId = process.env.STRIPE_MONTHLY_PRICE_ID;
  const yearlyPriceId = process.env.STRIPE_YEARLY_PRICE_ID;

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

  let body: { priceId?: string; plan?: "monthly" | "yearly" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let priceId: string;
  if (body.plan === "monthly") priceId = monthlyPriceId;
  else if (body.plan === "yearly") priceId = yearlyPriceId;
  else if (body.priceId && [monthlyPriceId, yearlyPriceId].includes(body.priceId)) priceId = body.priceId;
  else {
    return NextResponse.json(
      { error: "Provide plan: 'monthly' | 'yearly' or a valid priceId." },
      { status: 400 }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing`,
      client_reference_id: userId,
      allow_promotion_codes: true,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Payment system error. Please try again later." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json(
      { error: "Payment system error. Please try again later." },
      { status: 500 }
    );
  }
}
