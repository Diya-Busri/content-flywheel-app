import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { updateProfile, updateProfileByStripeCustomerId } from "@/db/queries/profiles-queries";
import { checkApiRateLimit, getClientIp } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { productOrdersTable } from "@/db/schema/product-orders-schema";
import { productSalesTable } from "@/db/schema/product-sales-schema";
import { productsTable } from "@/db/schema/products-schema";
import { emailAutomationsTable } from "@/db/schema/email-automations-schema";
import { creatorPromoCodesTable } from "@/db/schema/creator-promo-codes-schema";
import { productBundlesTable } from "@/db/schema/product-bundles-schema";
import { affiliateLinksTable, affiliateCommissionsTable } from "@/db/schema/affiliate-links-schema";
import { eq, and, sql, inArray, isNull } from "drizzle-orm";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const relevantEvents = new Set([
  "checkout.session.completed",
  "checkout.session.expired",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.trial_will_end",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
]);

export async function POST(request: NextRequest) {
  const rl = await checkApiRateLimit(getClientIp(request));
  if (rl) return rl;
  if (!WEBHOOK_SECRET) {
    console.error("[Stripe webhook] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    console.warn("[Stripe webhook] Missing stripe-signature header");
    return NextResponse.json(
      { error: "Missing stripe-signature" },
      { status: 400 }
    );
  }

  let body: string;
  try {
    body = await request.text();
  } catch (e) {
    console.error("[Stripe webhook] Failed to read body:", e);
    return NextResponse.json(
      { error: "Invalid body" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown signature error";
    console.error("[Stripe webhook] Signature verification failed:", message);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 }
    );
  }

  if (!relevantEvents.has(event.type)) {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "checkout.session.expired":
        await handleCheckoutSessionExpired(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.trial_will_end":
        // No-op: just acknowledging so Stripe knows we got it
        break;
      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error("[Stripe webhook] Handler error for", event.type, err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  // Handle native product purchases
  if (session.metadata?.type === "product_purchase") {
    await handleProductPurchase(session);
    return;
  }

  // Handle bundle purchases
  if (session.metadata?.type === "bundle_purchase") {
    await handleBundlePurchase(session);
    return;
  }

  if (session.mode !== "subscription" || !session.subscription || !session.customer) return;

  const userId = session.client_reference_id as string | null;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const price = subscription.items.data[0]?.price;
  const interval = price?.recurring?.interval;
  const planDuration = interval === "year" ? "yearly" : interval === "month" ? "monthly" : null;
  const billingCycleEnd = new Date(subscription.current_period_end * 1000);
  const stripePriceId = price?.id ?? null;
  const isTrial = subscription.status === "trialing";
  const trialFields = isTrial && subscription.trial_end
    ? { trialStartedAt: new Date(), trialEndsAt: new Date(subscription.trial_end * 1000) }
    : {};

  if (userId) {
    await updateProfile(userId, {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: stripePriceId ?? undefined,
      membership: "pro",
      status: "active",
      planDuration,
      billingCycleEnd,
      ...trialFields,
    });
  } else {
    await updateProfileByStripeCustomerId(customerId, {
      stripeSubscriptionId: subscriptionId,
      stripePriceId: stripePriceId ?? undefined,
      membership: "pro",
      status: "active",
      planDuration,
      billingCycleEnd,
      ...trialFields,
    });
  }
}

async function handleProductPurchase(session: Stripe.Checkout.Session) {
  const productId = session.metadata?.productId;
  const creatorUserId = session.metadata?.creatorUserId;

  if (!productId || !creatorUserId) {
    console.error("[stripe-webhook] product_purchase missing metadata", session.metadata);
    return;
  }

  const buyerEmail = session.customer_details?.email ?? "";
  const buyerName = session.customer_details?.name ?? null;
  const amountCents = session.amount_total ?? 0;

  const downloadToken = crypto.randomUUID();
  const downloadExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://contentflywheel.co.uk";

  // Insert order record
  await db.insert(productOrdersTable).values({
    productId,
    creatorUserId,
    buyerEmail,
    buyerName,
    amountCents,
    currency: session.currency ?? "gbp",
    stripeSessionId: session.id,
    status: "completed",
    downloadToken,
    downloadExpiresAt,
    emailSent: false,
  });

  // Fetch product title for the email
  const [product] = await db
    .select({ title: productsTable.title, id: productsTable.id })
    .from(productsTable)
    .where(eq(productsTable.id, productId))
    .limit(1);

  const downloadUrl = `${appUrl}/download/${productId}?token=${downloadToken}`;
  const productTitle = product?.title ?? "Digital Product";

  // Send delivery email
  try {
    await resend.emails.send({
      from: "hello@contentflywheel.co.uk",
      to: buyerEmail,
      subject: `Your download is ready: ${productTitle}`,
      html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#0B0B0F;padding:16px 32px;text-align:center;">
          <img src="https://contentflywheel.co.uk/logo.png" alt="Content Flywheel" width="130" style="display:inline-block;height:auto;" />
        </td></tr>
        <tr><td style="padding:36px 40px;color:#1a1a1a;font-size:16px;line-height:1.7;">
          <h2 style="margin:0 0 16px;font-size:22px;color:#111827;">Your download is ready!</h2>
          <p style="margin:0 0 16px;">Hi${buyerName ? ` ${buyerName}` : ""},</p>
          <p style="margin:0 0 24px;">Thank you for your purchase. Your download link is ready below and will be active for 7 days.</p>
          <p style="margin:0 0 24px;"><strong>${productTitle}</strong></p>
          <a href="${downloadUrl}" style="display:inline-block;padding:14px 32px;background:#f97316;color:#ffffff;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;">Download Now &rarr;</a>
          <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">This link expires in 7 days. If you need a new link, reply to this email.</p>
        </td></tr>
        <tr><td style="background:#F5C97A;padding:20px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#0B0B0F;">Powered by Content Flywheel</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
    });

    // Mark email as sent
    await db
      .update(productOrdersTable)
      .set({ emailSent: true })
      .where(eq(productOrdersTable.stripeSessionId, session.id));
  } catch (emailErr) {
    console.error("[stripe-webhook] Failed to send delivery email:", emailErr);
  }

  // Send creator's custom post-purchase email if configured
  try {
    const [postPurchaseAuto] = await db
      .select({ subject: emailAutomationsTable.subject, bodyHtml: emailAutomationsTable.bodyHtml })
      .from(emailAutomationsTable)
      .where(
        and(
          eq(emailAutomationsTable.userId, creatorUserId),
          eq(emailAutomationsTable.type, "post_purchase"),
          eq(emailAutomationsTable.enabled, true)
        )
      )
      .limit(1);

    if (postPurchaseAuto) {
      // Fetch creator brand name
      let fromName = "Content Flywheel";
      try {
        const { brandVoiceTable } = await import("@/db/schema/brand-voice-schema");
        const [bv] = await db.select({ brandName: brandVoiceTable.brandName }).from(brandVoiceTable).where(eq(brandVoiceTable.userId, creatorUserId)).limit(1);
        if (bv?.brandName?.trim()) fromName = bv.brandName.trim();
      } catch { /* ignore */ }

      const formattedBody = postPurchaseAuto.bodyHtml.includes("<")
        ? postPurchaseAuto.bodyHtml
        : postPurchaseAuto.bodyHtml.split(/\n\n+/).map((p) => `<p style="margin:0 0 16px 0;">${p.replace(/\n/g, "<br/>")}</p>`).join("");

      const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#0B0B0F;padding:16px 32px;text-align:center;">
          <img src="https://contentflywheel.co.uk/logo.png" alt="${fromName}" width="130" style="display:inline-block;height:auto;"/>
        </td></tr>
        <tr><td style="padding:36px 40px;color:#1a1a1a;font-size:16px;line-height:1.7;">${formattedBody}</td></tr>
        <tr><td style="background:#F5C97A;padding:20px 40px;text-align:center;">
          <p style="margin:0 0 6px;font-size:13px;color:#0B0B0F;font-weight:600;">${fromName}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

      await resend.emails.send({
        from: `${fromName} <hello@contentflywheel.co.uk>`,
        to: buyerEmail,
        subject: postPurchaseAuto.subject,
        html,
      });
      console.log(`[stripe-webhook] Post-purchase automation sent to ${buyerEmail}`);
    }
  } catch (err) {
    console.error("[stripe-webhook] Post-purchase automation error:", err);
  }

  // Log the sale in product_sales table (best-effort)
  await db.insert(productSalesTable).values({
    userId: creatorUserId,
    productId,
    platform: "content-flywheel",
    amountCents,
    currency: session.currency ?? "gbp",
    soldAt: new Date(),
  }).catch((err) => {
    console.warn("[stripe-webhook] Failed to log product sale:", err);
  });

  // Track affiliate commission if a ref code was used
  const affiliateRef = session.metadata?.affiliateRef;
  if (affiliateRef && creatorUserId) {
    const [link] = await db
      .select({ id: affiliateLinksTable.id, commissionPercent: affiliateLinksTable.commissionPercent })
      .from(affiliateLinksTable)
      .where(and(eq(affiliateLinksTable.code, affiliateRef), eq(affiliateLinksTable.creatorUserId, creatorUserId), eq(affiliateLinksTable.active, true)))
      .limit(1);
    if (link) {
      const commissionCents = Math.round(amountCents * link.commissionPercent / 100);
      await db.insert(affiliateCommissionsTable).values({
        affiliateLinkId: link.id,
        creatorUserId,
        orderSessionId: session.id,
        productTitle: productTitle,
        amountCents,
        commissionCents,
      }).catch(() => null);
    }
  }

  // Increment promo code usedCount if one was applied
  const promoCodeId = session.metadata?.promoCodeId;
  if (promoCodeId) {
    await db
      .update(creatorPromoCodesTable)
      .set({ usedCount: sql`${creatorPromoCodesTable.usedCount} + 1` })
      .where(
        and(
          eq(creatorPromoCodesTable.id, promoCodeId),
          eq(creatorPromoCodesTable.creatorUserId, creatorUserId)
        )
      )
      .catch((err) => {
        console.warn("[stripe-webhook] Failed to increment promo code usedCount:", err);
      });
  }
}

async function handleBundlePurchase(session: Stripe.Checkout.Session) {
  const bundleId = session.metadata?.bundleId;
  const creatorUserId = session.metadata?.creatorUserId;
  const productIdsRaw = session.metadata?.productIds ?? "";

  if (!bundleId || !creatorUserId) {
    console.error("[stripe-webhook] bundle_purchase missing metadata", session.metadata);
    return;
  }

  const buyerEmail = session.customer_details?.email ?? "";
  const buyerName = session.customer_details?.name ?? null;
  const amountCents = session.amount_total ?? 0;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://contentflywheel.co.uk";

  // Fetch bundle for its title
  const [bundle] = await db
    .select({ title: productBundlesTable.title, productIds: productBundlesTable.productIds })
    .from(productBundlesTable)
    .where(eq(productBundlesTable.id, bundleId))
    .limit(1);

  const bundleTitle = bundle?.title ?? "Bundle";
  const productIds = productIdsRaw ? productIdsRaw.split(",").filter(Boolean) : (bundle?.productIds ?? []);

  // Fetch all products in the bundle
  const products =
    productIds.length > 0
      ? await db
          .select({ id: productsTable.id, title: productsTable.title })
          .from(productsTable)
          .where(and(inArray(productsTable.id, productIds), isNull(productsTable.deletedAt)))
      : [];

  // Create one order record per product with shared download tokens
  const downloadTokens: { productId: string; title: string; token: string }[] = [];
  const downloadExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  for (const product of products) {
    const downloadToken = crypto.randomUUID();
    downloadTokens.push({ productId: product.id, title: product.title, token: downloadToken });

    await db.insert(productOrdersTable).values({
      productId: product.id,
      creatorUserId,
      buyerEmail,
      buyerName,
      amountCents: Math.round(amountCents / Math.max(products.length, 1)),
      currency: session.currency ?? "gbp",
      stripeSessionId: `${session.id}_${product.id}`,
      status: "completed",
      downloadToken,
      downloadExpiresAt,
      emailSent: false,
    }).catch(() => {/* ignore duplicate */});
  }

  // Send single combined download email
  if (buyerEmail && downloadTokens.length > 0) {
    const linksHtml = downloadTokens
      .map(
        (dt) =>
          `<tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
            <span style="font-size:14px;color:#1a1a1a;">${dt.title}</span><br/>
            <a href="${appUrl}/api/products/${dt.productId}/download?token=${dt.token}" style="font-size:13px;color:#f97316;text-decoration:none;font-weight:600;">Download →</a>
          </td></tr>`
      )
      .join("");

    try {
      await resend.emails.send({
        from: "hello@contentflywheel.co.uk",
        to: buyerEmail,
        subject: `Your bundle is ready: ${bundleTitle}`,
        html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#0B0B0F;padding:16px 32px;text-align:center;">
          <img src="https://contentflywheel.co.uk/logo.png" alt="Content Flywheel" width="130" style="display:inline-block;height:auto;"/>
        </td></tr>
        <tr><td style="padding:36px 40px;color:#1a1a1a;">
          <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;">Your bundle is ready! 🎉</h2>
          <p style="margin:0 0 24px;font-size:15px;color:#555;">Hi ${buyerName ?? "there"}, thank you for purchasing <strong>${bundleTitle}</strong>. Here are your download links:</p>
          <table width="100%" cellpadding="0" cellspacing="0">${linksHtml}</table>
          <p style="margin:24px 0 0;font-size:13px;color:#888;">Links expire in 7 days. Reply to this email if you need help.</p>
        </td></tr>
        <tr><td style="background:#F5C97A;padding:20px 40px;text-align:center;">
          <p style="margin:0;font-size:13px;color:#0B0B0F;font-weight:600;">Content Flywheel</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
      });
    } catch (err) {
      console.error("[stripe-webhook] Failed to send bundle email:", err);
    }
  }

  // Log one sale entry for the bundle total
  await db.insert(productSalesTable).values({
    userId: creatorUserId,
    productId: productIds[0] ?? bundleId,
    platform: "content-flywheel",
    amountCents,
    currency: session.currency ?? "gbp",
    soldAt: new Date(),
  }).catch((err) => {
    console.warn("[stripe-webhook] Failed to log bundle sale:", err);
  });
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  if (subscription.status !== "active" && subscription.status !== "trialing") {
    return;
  }
  const customerId = subscription.customer as string;
  const price = subscription.items.data[0]?.price;
  const interval = price?.recurring?.interval;
  const planDuration = interval === "year" ? "yearly" : interval === "month" ? "monthly" : null;
  const billingCycleEnd = new Date(subscription.current_period_end * 1000);
  const stripePriceId = price?.id ?? null;
  const isTrial = subscription.status === "trialing";
  const trialFields = isTrial && subscription.trial_end
    ? { trialStartedAt: new Date(), trialEndsAt: new Date(subscription.trial_end * 1000) }
    : {};

  await updateProfileByStripeCustomerId(customerId, {
    stripeSubscriptionId: subscription.id,
    stripePriceId: stripePriceId ?? undefined,
    membership: "pro",
    status: "active",
    planDuration,
    billingCycleEnd,
    ...trialFields,
  });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const price = subscription.items.data[0]?.price;
  const interval = price?.recurring?.interval;
  const planDuration = interval === "year" ? "yearly" : interval === "month" ? "monthly" : null;
  const billingCycleEnd = new Date(subscription.current_period_end * 1000);
  const status = mapStripeStatus(subscription.status);

  await updateProfileByStripeCustomerId(customerId, {
    stripeSubscriptionId: subscription.id,
    stripePriceId: price?.id ?? undefined,
    status,
    planDuration,
    billingCycleEnd,
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  // Detect trial cancellation: trial_end is in the future, so they bailed early
  const trialEnd = subscription.trial_end ? subscription.trial_end * 1000 : null;
  const cancelledDuringTrial = trialEnd !== null && trialEnd > Date.now();

  await updateProfileByStripeCustomerId(customerId, {
    membership: "free",
    status: "cancelled",
    stripeSubscriptionId: null,
    stripePriceId: null,
    planDuration: null,
    billingCycleEnd: null,
    ...(cancelledDuringTrial ? { trialCancelledAt: new Date() } : {}),
  });
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  if (!invoice.subscription || !invoice.customer) return;
  const customerId = invoice.customer as string;
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
  const billingCycleEnd = new Date(subscription.current_period_end * 1000);
  // If this subscription had a trial and the invoice has a positive amount,
  // the user just converted from trial to paid
  const convertedFromTrial = !!(subscription.trial_end && (invoice.amount_paid ?? 0) > 0);

  await updateProfileByStripeCustomerId(customerId, {
    status: "active",
    billingCycleEnd,
    ...(convertedFromTrial ? { trialConverted: true } : {}),
  });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  if (!invoice.customer) return;
  const customerId = invoice.customer as string;
  await updateProfileByStripeCustomerId(customerId, {
    status: "past_due",
  });
}

async function handleCheckoutSessionExpired(session: Stripe.Checkout.Session) {
  // Only recover abandoned product purchases
  if (session.metadata?.type !== "product_purchase") return;

  const email = session.customer_details?.email;
  const productId = session.metadata?.productId;
  if (!email || !productId) return;

  // Fetch product details for the email
  const [product] = await db
    .select({ title: productsTable.title, marketingAssets: productsTable.marketingAssets })
    .from(productsTable)
    .where(and(eq(productsTable.id, productId), isNull(productsTable.deletedAt)))
    .limit(1);

  if (!product) return;

  const ma = (product.marketingAssets ?? {}) as { nativePrice?: number; coverThumbnailUrl?: string | null };
  const priceLabel = ma.nativePrice ? `£${(ma.nativePrice / 100).toFixed(2)}` : "";
  const productUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://contentflywheel.co.uk"}/product/${productId}`;
  const buyUrl = `${productUrl}`;

  // Fire-and-forget — if this fails, we just don't send the email
  await resend.emails.send({
    from: "Content Flywheel <noreply@contentflywheel.co.uk>",
    to: email,
    subject: `You left something behind — ${product.title}`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
        <tr>
          <td style="background:linear-gradient(135deg,#f97316 0%,#fb923c 100%);padding:36px 40px;text-align:center;">
            <p style="margin:0;font-size:40px;">🛒</p>
            <h1 style="margin:12px 0 0;color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">You left something behind</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">
              Hi there,
            </p>
            <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.6;">
              You were this close to getting <strong>${product.title}</strong>${priceLabel ? ` for ${priceLabel}` : ""}.
            </p>
            <p style="margin:0 0 28px;color:#6b7280;font-size:15px;line-height:1.7;">
              Your spot is still available — click below to complete your purchase.
            </p>
            <a href="${buyUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;font-weight:700;font-size:16px;border-radius:12px;text-decoration:none;letter-spacing:-0.2px;">
              Complete my purchase →
            </a>
            <hr style="border:none;border-top:1px solid #f3f4f6;margin:32px 0;"/>
            <p style="margin:0;color:#9ca3af;font-size:13px;">
              You received this because you started checkout but didn&rsquo;t complete it.
              If you&rsquo;re not interested, simply ignore this email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  }).catch((e) => console.error("[abandoned-checkout] email error:", e));
}

function mapStripeStatus(stripeStatus: Stripe.Subscription["status"]): string {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "cancelled";
    default:
      return stripeStatus ?? "active";
  }
}
