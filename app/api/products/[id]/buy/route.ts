import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { storeSettingsTable } from "@/db/schema/store-settings-schema";
import { eq, and, isNull } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://contentflywheel.co.uk";

type ExtendedMarketingAssets = {
  isNativePublished?: boolean;
  stripePriceId?: string;
  nativePrice?: number;
};

export async function POST(
  _request: Request,
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

    // Build checkout session params
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      line_items: [{ price: ma.stripePriceId, quantity: 1 }],
      success_url: `${baseUrl}/product/${productId}?purchased=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/product/${productId}`,
      metadata: {
        type: "product_purchase",
        productId: product.id,
        creatorUserId: product.userId,
        vatEnabled: vatEnabled ? "true" : "false",
      },
      allow_promotion_codes: true,
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
