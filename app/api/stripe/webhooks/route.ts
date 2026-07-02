import { manageSubscriptionStatusChange, updateStripeCustomer } from "@/actions/stripe-actions";
import { stripe } from "@/lib/stripe";
import { headers } from "next/headers";
import Stripe from "stripe";
import { updateProfile, updateProfileByStripeCustomerId, getProfileByUserId } from "@/db/queries/profiles-queries";
import { VIDEO_CREDITS_METADATA_KEY, SUBSCRIPTION_VIDEO_CREDITS } from "@/lib/video-credits";
import { CUSTOM_DOMAIN_METADATA_KEY } from "@/app/api/custom-domain/checkout/route";
import { db } from "@/db/db";
import { videoCreditTransactionsTable } from "@/db/schema/video-credit-transactions-schema";
import { promoCodesTable, promoCodeUsesTable } from "@/db/schema/promo-codes-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { storeSettingsTable } from "@/db/schema/store-settings-schema";
import { eq, sql } from "drizzle-orm";

/**
 * Add video credits to a subscriber's balance by Stripe customer ID.
 * Fetches current balance first so we ADD rather than overwrite.
 */
async function addSubscriptionVideoCredits(
  stripeCustomerId: string,
  interval: "month" | "year",
  label: string
): Promise<void> {
  const creditsToAdd = SUBSCRIPTION_VIDEO_CREDITS[interval];

  // Find profile by Stripe customer ID
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.stripeCustomerId, stripeCustomerId));

  if (!profile) {
    console.warn(`[sub-credits] No profile found for Stripe customer ${stripeCustomerId}`);
    return;
  }

  const currentCredits = profile.videoCredits ?? 0;
  const newBalance = currentCredits + creditsToAdd;

  await updateProfile(profile.userId, { videoCredits: newBalance });

  await db.insert(videoCreditTransactionsTable).values({
    userId: profile.userId,
    type: "purchase",
    amount: creditsToAdd,
    description: `📅 ${label} — ${creditsToAdd} credits included`,
  }).catch((e) => console.error("[sub-credits] Failed to log transaction:", e));

  console.log(`[sub-credits] Added ${creditsToAdd} credits to ${profile.userId} (${label}). Balance: ${currentCredits} → ${newBalance}`);
}

export const dynamic = "force-dynamic";
const relevantEvents = new Set([
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
  "account.updated", // Stripe Connect: creator onboarding
]);

// Default usage credits for Pro plan
const DEFAULT_USAGE_CREDITS = 250;

export async function POST(req: Request) {
  const body = await req.text();
  const sig = headers().get("Stripe-Signature") as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event: Stripe.Event;

  try {
    if (!sig || !webhookSecret) {
      throw new Error("Webhook secret or signature missing");
    }

    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (relevantEvents.has(event.type)) {
    try {
      switch (event.type) {
        case "customer.subscription.updated":
        case "customer.subscription.deleted":
          await handleSubscriptionChange(event);
          break;

        case "checkout.session.completed":
          await handleCheckoutSession(event);
          break;
          
        case "invoice.payment_succeeded":
          await handlePaymentSuccess(event);
          break;
          
        case "invoice.payment_failed":
          await handlePaymentFailed(event);
          break;

        case "account.updated":
          await handleConnectAccountUpdated(event);
          break;

        default:
          throw new Error("Unhandled relevant event!");
      }
    } catch (error) {
      console.error("Webhook handler failed:", error);
      return new Response("Webhook handler failed. View your nextjs function logs.", {
        status: 400
      });
    }
  }

  return new Response(JSON.stringify({ received: true }));
}

async function handleSubscriptionChange(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  const productId = subscription.items.data[0].price.product as string;
  await manageSubscriptionStatusChange(subscription.id, subscription.customer as string, productId);
}

async function handleCheckoutSession(event: Stripe.Event) {
  const checkoutSession = event.data.object as Stripe.Checkout.Session;

  // ── One-time video credit purchase ──────────────────────────────────────────
  if (
    checkoutSession.mode === "payment" &&
    checkoutSession.metadata?.[VIDEO_CREDITS_METADATA_KEY] === "true"
  ) {
    const userId = checkoutSession.client_reference_id ?? checkoutSession.metadata?.userId;
    const credits = parseInt(checkoutSession.metadata?.credits ?? "0", 10);

    if (userId && credits > 0) {
      try {
        const profile = await getProfileByUserId(userId);
        const current = profile?.videoCredits ?? 0;
        await updateProfile(userId, { videoCredits: current + credits });
        console.log(`[video-credits] Added ${credits} credits to user ${userId} (new balance: ${current + credits})`);
        // Log the purchase transaction
        const packLabel = checkoutSession.metadata?.packId ?? "Credit pack";
        await db.insert(videoCreditTransactionsTable).values({
          userId,
          type: "purchase",
          amount: credits,
          description: `Purchased ${credits} video credits (${packLabel})`,
        }).catch((err) => console.error("[video-credits] Failed to log purchase transaction:", err));
      } catch (err) {
        console.error("[video-credits] Failed to add credits:", err);
      }
    }
    return; // Don't fall through to subscription handling
  }

  // ── Custom domain activation ────────────────────────────────────────────────
  if (
    checkoutSession.mode === "payment" &&
    checkoutSession.metadata?.[CUSTOM_DOMAIN_METADATA_KEY] === "true"
  ) {
    const userId = checkoutSession.client_reference_id ?? checkoutSession.metadata?.userId;
    if (userId) {
      try {
        await db
          .insert(storeSettingsTable)
          .values({ userId, customDomainActive: true, updatedAt: new Date() })
          .onConflictDoUpdate({
            target: storeSettingsTable.userId,
            set: { customDomainActive: true, updatedAt: new Date() },
          });
        console.log(`[custom-domain] Activated custom domain for user ${userId}`);
      } catch (err) {
        console.error("[custom-domain] Failed to activate:", err);
      }
    }
    return;
  }

  if (checkoutSession.mode === "subscription") {
    const subscriptionId = checkoutSession.subscription as string;
    await updateStripeCustomer(checkoutSession.client_reference_id as string, subscriptionId, checkoutSession.customer as string);

    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["default_payment_method"]
    });

    const productId = subscription.items.data[0].price.product as string;
    await manageSubscriptionStatusChange(subscription.id, subscription.customer as string, productId);
    
    // Record promo code usage if one was applied
    const promoCode = checkoutSession.metadata?.promoCode;
    if (promoCode && checkoutSession.client_reference_id) {
      try {
        const [promo] = await db.select().from(promoCodesTable).where(eq(promoCodesTable.code, promoCode));
        if (promo) {
          await db.insert(promoCodeUsesTable).values({
            codeId: promo.id,
            userId: checkoutSession.client_reference_id,
          }).onConflictDoNothing();
          await db.update(promoCodesTable)
            .set({ usedCount: sql`${promoCodesTable.usedCount} + 1` })
            .where(eq(promoCodesTable.id, promo.id));
          console.log(`[promo] Recorded use of ${promoCode} for user ${checkoutSession.client_reference_id}`);
        }
      } catch (err) {
        console.error("[promo] Failed to record promo code use:", err);
      }
    }

    // Reset usage credits on new subscription
    if (checkoutSession.client_reference_id) {
      try {
        const billingCycleStart = new Date(subscription.current_period_start * 1000);
        const billingCycleEnd = new Date(subscription.current_period_end * 1000);

        await updateProfile(checkoutSession.client_reference_id, {
          usageCredits: DEFAULT_USAGE_CREDITS,
          usedCredits: 0,
          status: "active",
          billingCycleStart,
          billingCycleEnd
        });

        console.log(`Reset usage credits to ${DEFAULT_USAGE_CREDITS} for user ${checkoutSession.client_reference_id}`);
      } catch (error) {
        console.error(`Error updating usage credits: ${error}`);
      }
    }

    // Add monthly video credits on new subscription
    const interval = (subscription.items.data[0]?.price?.recurring?.interval ?? "month") as "month" | "year";
    const planLabel = interval === "year" ? "Annual plan monthly credits" : "Monthly plan credits";
    await addSubscriptionVideoCredits(
      checkoutSession.customer as string,
      interval,
      planLabel
    ).catch((e) => console.error("[sub-credits] Failed to add signup credits:", e));
  }
}

async function handlePaymentSuccess(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  const customerId = invoice.customer as string;

  if (invoice.subscription) {
    try {
      // Get the subscription to determine billing cycle dates and interval
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);

      const billingCycleStart = new Date(subscription.current_period_start * 1000);
      const billingCycleEnd = new Date(subscription.current_period_end * 1000);

      // Reset usage credits (legacy system)
      await updateProfileByStripeCustomerId(customerId, {
        usageCredits: DEFAULT_USAGE_CREDITS,
        usedCredits: 0,
        status: "active",
        billingCycleStart,
        billingCycleEnd
      });

      console.log(`Reset usage credits to ${DEFAULT_USAGE_CREDITS} for Stripe customer ${customerId}`);

      // Skip the first invoice — checkout.session.completed already handled it
      // billing_reason "subscription_create" = first payment, "subscription_cycle" = renewal
      const isRenewal = invoice.billing_reason === "subscription_cycle";
      if (isRenewal) {
        const interval = (subscription.items.data[0]?.price?.recurring?.interval ?? "month") as "month" | "year";
        const planLabel = interval === "year" ? "Annual plan — monthly top-up" : "Monthly plan renewal credits";
        await addSubscriptionVideoCredits(customerId, interval, planLabel)
          .catch((e) => console.error("[sub-credits] Failed to add renewal credits:", e));
      }
    } catch (error) {
      console.error(`Error processing payment success: ${error}`);
    }
  }
}

async function handlePaymentFailed(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  const customerId = invoice.customer as string;

  try {
    // Update profile directly by Stripe customer ID
    const updatedProfile = await updateProfileByStripeCustomerId(customerId, {
      status: "payment_failed"
    });

    if (updatedProfile) {
      console.log(`Marked payment as failed for user ${updatedProfile.userId}`);
    } else {
      console.error(`No profile found for Stripe customer: ${customerId}`);
    }
  } catch (error) {
    console.error(`Error processing payment failure: ${error}`);
  }
}

/**
 * Stripe Connect: fired when a creator's connected account is updated.
 * Syncs charges_enabled and details_submitted to their profile.
 */
async function handleConnectAccountUpdated(event: Stripe.Event) {
  const account = event.data.object as Stripe.Account;
  const contentFlyWheelUserId = account.metadata?.contentFlyWheelUserId;

  if (!contentFlyWheelUserId) {
    // Not a ContentFlywheel-created account (or missing metadata), skip
    return;
  }

  try {
    await db
      .update(profilesTable)
      .set({
        stripeConnectOnboardingComplete: account.details_submitted,
        stripeConnectChargesEnabled: account.charges_enabled,
      })
      .where(eq(profilesTable.userId, contentFlyWheelUserId));

    console.log(
      `[connect] Updated account for user ${contentFlyWheelUserId}: ` +
      `charges_enabled=${account.charges_enabled}, details_submitted=${account.details_submitted}`
    );
  } catch (err) {
    console.error("[connect] Failed to update profile:", err);
  }
}
