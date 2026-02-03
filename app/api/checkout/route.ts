import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";

/**
 * GET /api/checkout?plan=monthly|yearly
 * Creates a Stripe Checkout Session and redirects to Stripe-hosted payment page.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const plan = searchParams.get("plan"); // "monthly" | "yearly"

  if (!plan || !["monthly", "yearly"].includes(plan)) {
    return NextResponse.redirect(new URL("/pricing?error=invalid_plan", request.url));
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.error("STRIPE_SECRET_KEY is not set");
    return NextResponse.redirect(new URL("/pricing?error=config", request.url));
  }

  const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });
  const { userId } = auth();

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  const lineItem: Stripe.Checkout.SessionCreateParams.LineItem =
    plan === "monthly"
      ? {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Content Flywheel — Monthly",
              description: "Flexible month-to-month access.",
            },
            unit_amount: 5999, // $59.99
            recurring: { interval: "month" },
          },
          quantity: 1,
        }
      : {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Content Flywheel — Yearly",
              description: "Save when you commit for a year. Billed annually.",
            },
            unit_amount: 49999, // $499.99
            recurring: { interval: "year" },
          },
          quantity: 1,
        };

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [lineItem],
      success_url: `${baseUrl}/dashboard?checkout=success`,
      cancel_url: `${baseUrl}/pricing?checkout=cancelled`,
      client_reference_id: userId ?? undefined,
      allow_promotion_codes: true,
    });

    if (!session.url) {
      return NextResponse.redirect(new URL("/pricing?error=session", request.url));
    }

    return NextResponse.redirect(session.url);
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.redirect(new URL("/pricing?error=checkout", request.url));
  }
}
