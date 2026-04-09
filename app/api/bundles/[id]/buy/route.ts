import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/db/db";
import { productBundlesTable } from "@/db/schema/product-bundles-schema";
import { eq, and } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://contentflywheel.co.uk";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: bundleId } = await params;

  const [bundle] = await db
    .select()
    .from(productBundlesTable)
    .where(and(eq(productBundlesTable.id, bundleId), eq(productBundlesTable.active, true)))
    .limit(1);

  if (!bundle) {
    return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: { name: bundle.title },
            unit_amount: bundle.bundlePrice,
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/bundle/${bundleId}?purchased=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/bundle/${bundleId}`,
      metadata: {
        type: "bundle_purchase",
        bundleId: bundle.id,
        creatorUserId: bundle.creatorUserId,
        productIds: bundle.productIds.join(","),
      },
      billing_address_collection: "auto",
      customer_creation: "always",
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[bundles/buy] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
