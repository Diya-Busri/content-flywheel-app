/**
 * POST /api/custom-domain/checkout
 * Creates a £9.99 Stripe Checkout session for a one-time custom domain activation.
 * On success, the webhook sets customDomainActive = true on the user's store settings.
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

export const CUSTOM_DOMAIN_METADATA_KEY = "custom_domain_purchase";

const PRODUCTION_DOMAIN = "https://contentflywheel.co.uk";
function getBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (env && env.startsWith("https://contentflywheel.co.uk")) return env.replace(/\/$/, "");
  return PRODUCTION_DOMAIN;
}

export async function POST() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) return NextResponse.json({ error: "Payment not configured" }, { status: 500 });

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });
  const baseUrl = getBaseUrl();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: 1999, // £19.99
            product_data: {
              name: "Custom Domain — Content Flywheel",
              description: "Connect your own .com domain to your Content Flywheel store. One-time unlock.",
            },
          },
        },
      ],
      success_url: `${baseUrl}/dashboard/store/customize?domain_activated=1`,
      cancel_url: `${baseUrl}/dashboard/video-credits`,
      client_reference_id: userId,
      metadata: {
        [CUSTOM_DOMAIN_METADATA_KEY]: "true",
        userId,
      },
    });

    if (!session.url) return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[custom-domain/checkout]", err);
    return NextResponse.json({ error: "Payment error. Please try again." }, { status: 500 });
  }
}
