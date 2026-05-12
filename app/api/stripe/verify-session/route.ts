import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import Stripe from "stripe";
import { updateProfile } from "@/db/queries/profiles-queries";

/**
 * GET /api/stripe/verify-session?session_id=cs_xxx
 * Called when user returns from Stripe Checkout (or via redirect from /dashboard?session_id=xxx).
 * Retrieves the checkout session from Stripe, updates the user's profile with subscription
 * details, then redirects to /dashboard. This activates the subscription immediately without
 * relying on webhooks.
 */
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id");
  if (!sessionId || !sessionId.startsWith("cs_")) {
    return NextResponse.redirect(new URL("/pricing", request.url));
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.error("[Stripe verify-session] STRIPE_SECRET_KEY is not set");
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.mode !== "subscription" || !session.subscription || !session.customer) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    const clientReferenceId = session.client_reference_id as string | null;
    if (clientReferenceId && clientReferenceId !== userId) {
      console.warn("[Stripe verify-session] session client_reference_id does not match current user");
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    const customerId = session.customer as string;
    const subscriptionId = session.subscription as string;

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const price = subscription.items.data[0]?.price;
    const interval = price?.recurring?.interval;
    const planDuration = interval === "year" ? "yearly" : interval === "month" ? "monthly" : null;
    const billingCycleEnd = new Date(subscription.current_period_end * 1000);
    const stripePriceId = price?.id ?? null;

    await updateProfile(userId, {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: stripePriceId ?? undefined,
      membership: "pro",
      status: subscription.status === "trialing" ? "trialing" : "active",
      planDuration,
      billingCycleEnd,
    });
  } catch (err) {
    console.error("[Stripe verify-session] Error:", err);
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
