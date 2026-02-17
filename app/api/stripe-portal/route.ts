import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getProfileByUserId } from "@/db/queries/profiles-queries";
import Stripe from "stripe";

/**
 * POST /api/stripe-portal
 * Creates a Stripe Customer Portal session so the user can manage their subscription.
 * Returns { url: string }.
 */
export async function POST(request: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 500 }
    );
  }
  if (!secretKey.startsWith("sk_test_") && !secretKey.startsWith("sk_live_")) {
    return NextResponse.json(
      {
        error:
          "Invalid STRIPE_SECRET_KEY: use the Secret key from Stripe Dashboard → Developers → API keys (it must start with sk_test_ or sk_live_).",
      },
      { status: 500 }
    );
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getProfileByUserId(userId);
  const customerId = profile?.stripeCustomerId ?? null;
  if (!customerId) {
    return NextResponse.json(
      { error: "No billing account found. Subscribe first from the pricing page." },
      { status: 400 }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/dashboard/settings`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Failed to create portal session" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe portal error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Portal failed" },
      { status: 500 }
    );
  }
}
