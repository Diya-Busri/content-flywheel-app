/**
 * POST /api/video-credits/checkout
 * Creates a Stripe Checkout session for a one-time video credit pack purchase.
 * Body: { packId: string }
 * Returns: { url: string }
 *
 * On success, Stripe redirects to /dashboard/video-credits?success=1
 * The webhook handler (stripe/webhooks) adds credits to the user's profile.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { VIDEO_CREDIT_PACKS, VIDEO_CREDITS_METADATA_KEY } from "@/lib/video-credits";

export const dynamic = "force-dynamic";

const PRODUCTION_DOMAIN = "https://contentflywheel.co.uk";
function getBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (env && env.startsWith("https://contentflywheel.co.uk")) return env.replace(/\/$/, "");
  return PRODUCTION_DOMAIN;
}

export async function POST(request: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) return NextResponse.json({ error: "Payment not configured" }, { status: 500 });

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { packId?: string };
  const pack = VIDEO_CREDIT_PACKS.find((p) => p.id === body.packId);
  if (!pack) return NextResponse.json({ error: "Invalid pack" }, { status: 400 });

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
            unit_amount: pack.priceStripe,
            product_data: {
              name: `${pack.credits} Video Credits — ${pack.label}`,
              description: `Generate ${pack.credits} AI videos in Content Flywheel. Credits never expire.`,
            },
          },
        },
      ],
      success_url: `${baseUrl}/dashboard/video-credits?success=1&credits=${pack.credits}`,
      cancel_url: `${baseUrl}/dashboard/video-credits`,
      client_reference_id: userId,
      metadata: {
        [VIDEO_CREDITS_METADATA_KEY]: "true",
        credits: String(pack.credits),
        packId: pack.id,
        userId,
      },
    });

    if (!session.url) return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[video-credits/checkout]", err);
    return NextResponse.json({ error: "Payment error. Please try again." }, { status: 500 });
  }
}
