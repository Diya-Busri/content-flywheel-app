import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { updateProfile, updateProfileByStripeCustomerId } from "@/db/queries/profiles-queries";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const relevantEvents = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
]);

export async function POST(request: NextRequest) {
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
      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
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

  if (userId) {
    await updateProfile(userId, {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: stripePriceId ?? undefined,
      membership: "pro",
      status: "active",
      planDuration,
      billingCycleEnd,
    });
  } else {
    await updateProfileByStripeCustomerId(customerId, {
      stripeSubscriptionId: subscriptionId,
      stripePriceId: stripePriceId ?? undefined,
      membership: "pro",
      status: "active",
      planDuration,
      billingCycleEnd,
    });
  }
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

  await updateProfileByStripeCustomerId(customerId, {
    stripeSubscriptionId: subscription.id,
    stripePriceId: stripePriceId ?? undefined,
    membership: "pro",
    status: subscription.status === "active" || subscription.status === "trialing" ? "active" : (subscription.status as string),
    planDuration,
    billingCycleEnd,
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
  await updateProfileByStripeCustomerId(customerId, {
    membership: "free",
    status: "cancelled",
    stripeSubscriptionId: null,
    stripePriceId: null,
    planDuration: null,
    billingCycleEnd: null,
  });
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  if (!invoice.subscription || !invoice.customer) return;
  const customerId = invoice.customer as string;
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
  const billingCycleEnd = new Date(subscription.current_period_end * 1000);

  await updateProfileByStripeCustomerId(customerId, {
    status: "active",
    billingCycleEnd,
  });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  if (!invoice.customer) return;
  const customerId = invoice.customer as string;
  await updateProfileByStripeCustomerId(customerId, {
    status: "past_due",
  });
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
