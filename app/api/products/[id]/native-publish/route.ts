import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { productWaitlistsTable } from "@/db/schema/product-waitlists-schema";
import { eq, and, isNull } from "drizzle-orm";
import type { MarketingAssets } from "@/db/schema/products-schema";
import { Resend } from "resend";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://contentflywheel.co.uk";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params;

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const price = body.price;
    const subscriptionInterval: "month" | "year" | null = body.subscriptionInterval ?? null;
    const payWhatYouWant: boolean = body.payWhatYouWant ?? false;
    const minPrice: number | null = typeof body.minPrice === "number" ? body.minPrice : null;

    // For PWYW, price is the suggested/default amount — allow £0 minimum
    if (typeof price !== "number" || (!payWhatYouWant && price < 100)) {
      return NextResponse.json(
        { error: "Invalid price. Minimum is 100 pence (£1.00)." },
        { status: 400 }
      );
    }

    const [product] = await db
      .select()
      .from(productsTable)
      .where(
        and(
          eq(productsTable.id, productId),
          eq(productsTable.userId, userId),
          isNull(productsTable.deletedAt)
        )
      )
      .limit(1);

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const existing = (product.marketingAssets ?? {}) as MarketingAssets & {
      nativePrice?: number;
      stripePriceId?: string;
      stripeProductId?: string;
      isNativePublished?: boolean;
    };

    // Create or reuse Stripe product
    let stripeProductId = existing.stripeProductId;
    if (!stripeProductId) {
      const stripeProduct = await stripe.products.create({
        name: product.title,
        metadata: {
          productId: product.id,
          creatorUserId: userId,
        },
      });
      stripeProductId = stripeProduct.id;
    } else {
      // Update product name and reactivate in case it was archived by a previous unpublish
      await stripe.products.update(stripeProductId, { name: product.title, active: true }).catch(() => {});
    }

    // Always create a new price (Stripe prices are immutable)
    // For subscription products, use a recurring price
    const stripePrice = await stripe.prices.create({
      product: stripeProductId,
      unit_amount: price,
      currency: "gbp",
      ...(subscriptionInterval
        ? { recurring: { interval: subscriptionInterval } }
        : {}),
    });

    // Archive old price if there was one
    if (existing.stripePriceId && existing.stripePriceId !== stripePrice.id) {
      await stripe.prices.update(existing.stripePriceId, { active: false }).catch(() => {});
    }
    // Also archive old subscription price if switching modes
    const existingSubPriceId = (existing as { stripeSubscriptionPriceId?: string }).stripeSubscriptionPriceId;
    if (existingSubPriceId && existingSubPriceId !== stripePrice.id) {
      await stripe.prices.update(existingSubPriceId, { active: false }).catch(() => {});
    }

    const intervalLabel = subscriptionInterval === "month" ? "/mo" : subscriptionInterval === "year" ? "/yr" : "";
    const pwywLabel = payWhatYouWant
      ? minPrice && minPrice > 0
        ? `£${(minPrice / 100).toFixed(2)}+`
        : "Pay what you want"
      : null;
    const priceLabel = pwywLabel ?? `£${(price / 100).toFixed(2)}${intervalLabel}`;

    const updatedAssets: MarketingAssets & {
      nativePrice: number;
      stripePriceId: string;
      stripeProductId: string;
      isNativePublished: boolean;
    } = {
      ...existing,
      nativePrice: price,
      stripePriceId: subscriptionInterval ? (existing.stripePriceId ?? stripePrice.id) : stripePrice.id,
      ...(subscriptionInterval ? { stripeSubscriptionPriceId: stripePrice.id, subscriptionInterval } : { stripeSubscriptionPriceId: null, subscriptionInterval: null }),
      stripeProductId,
      isNativePublished: true,
      priceLabel,
      payWhatYouWant,
      minPrice: payWhatYouWant ? (minPrice ?? 0) : null,
    };

    await db
      .update(productsTable)
      .set({ marketingAssets: updatedAssets, updatedAt: new Date() })
      .where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId)));

    // If this is the first publish (was not already published), notify waitlist subscribers
    if (!existing.isNativePublished) {
      notifyWaitlist(productId, product.title, priceLabel).catch((e) =>
        console.error("[native-publish] waitlist notify error:", e)
      );
    }

    return NextResponse.json({ success: true, priceLabel });
  } catch (err) {
    console.error("[native-publish] POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to publish" },
      { status: 500 }
    );
  }
}

// ── Fire-and-forget: email all waitlist subscribers that the product is live ──
async function notifyWaitlist(productId: string, productTitle: string, priceLabel: string) {
  const subscribers = await db
    .select({ email: productWaitlistsTable.email, name: productWaitlistsTable.name })
    .from(productWaitlistsTable)
    .where(eq(productWaitlistsTable.productId, productId));

  if (subscribers.length === 0) return;

  const productUrl = `${APP_URL}/product/${productId}`;

  // Send individually so each can have personalised greeting
  await Promise.allSettled(
    subscribers.map(({ email, name }) =>
      resend.emails.send({
        from: "Content Flywheel <noreply@contentflywheel.co.uk>",
        to: email,
        subject: `🎉 It's live! ${productTitle} is now available`,
        html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
        <tr>
          <td style="background:linear-gradient(135deg,#f97316 0%,#fb923c 100%);padding:36px 40px;text-align:center;">
            <p style="margin:0;font-size:40px;">🚀</p>
            <h1 style="margin:12px 0 0;color:#fff;font-size:24px;font-weight:700;letter-spacing:-0.3px;">It&rsquo;s live!</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">
              Hi${name ? ` ${name}` : ""},
            </p>
            <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.6;">
              You joined the waitlist for <strong>${productTitle}</strong> — and it&rsquo;s now available!
            </p>
            <p style="margin:0 0 28px;color:#6b7280;font-size:15px;line-height:1.7;">
              Price: <strong style="color:#111827;">${priceLabel}</strong>
            </p>
            <a href="${productUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;font-weight:700;font-size:16px;border-radius:12px;text-decoration:none;letter-spacing:-0.2px;">
              Get it now &rarr;
            </a>
            <hr style="border:none;border-top:1px solid #f3f4f6;margin:32px 0;"/>
            <p style="margin:0;color:#9ca3af;font-size:13px;">
              You&rsquo;re receiving this because you joined the waitlist.
              <a href="${APP_URL}/unsubscribe" style="color:#f97316;">Unsubscribe</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
      })
    )
  );
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params;

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [product] = await db
      .select()
      .from(productsTable)
      .where(
        and(
          eq(productsTable.id, productId),
          eq(productsTable.userId, userId),
          isNull(productsTable.deletedAt)
        )
      )
      .limit(1);

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const existing = (product.marketingAssets ?? {}) as MarketingAssets & {
      isNativePublished?: boolean;
      stripeProductId?: string;
      stripePriceId?: string;
    };

    // Archive the Stripe price when unpublishing
    if (existing.stripePriceId) {
      await stripe.prices.update(existing.stripePriceId, { active: false }).catch(() => {});
    }
    if (existing.stripeProductId) {
      await stripe.products.update(existing.stripeProductId, { active: false }).catch(() => {});
    }

    const updatedAssets = {
      ...existing,
      isNativePublished: false,
    };

    await db
      .update(productsTable)
      .set({ marketingAssets: updatedAssets, updatedAt: new Date() })
      .where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId)));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[native-publish] DELETE error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to unpublish" },
      { status: 500 }
    );
  }
}
