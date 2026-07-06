/**
 * /subscribe/success?session_id=cs_xxx
 *
 * Stripe redirects here after a successful checkout.
 * We verify the session server-side, update the profile immediately
 * (so the user isn't stuck on the paywall waiting for the webhook),
 * then redirect to /dashboard.
 */
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { updateProfile, getProfileByUserId } from "@/db/queries/profiles-queries";
import { db } from "@/db/db";
import { promoCodesTable } from "@/db/schema/promo-codes-schema";
import { eq, sql } from "drizzle-orm";

export default async function SubscribeSuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  const { userId } = await auth();
  const sessionId = searchParams.session_id;
  if (!sessionId) redirect("/dashboard");

  // If the Clerk session has expired during the Stripe checkout flow, preserve the session_id
  // in the return URL so the user can sign back in and re-run activation without losing context.
  if (!userId) {
    redirect(`/sign-in?redirect_url=${encodeURIComponent(`/subscribe/success?session_id=${sessionId}`)}`);
  }

  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) redirect("/dashboard");

  try {
    const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    // Trust the session if client_reference_id matches, OR metadata.userId matches (fallback).
    // A mismatch can occur if the Clerk session briefly expired during checkout;
    // in that case we still activate so the user isn't stuck on the paywall.
    const sessionUserId =
      session.client_reference_id ??
      (session.metadata as Record<string, string> | null)?.userId;

    if (sessionUserId && sessionUserId !== userId) {
      console.warn("[subscribe/success] session userId mismatch — skipping activation", {
        session: sessionUserId,
        clerk: userId,
      });
      redirect("/dashboard");
    }

    if (session.status === "complete" || session.payment_status === "paid" || session.payment_status === "no_payment_required") {
      const sub = session.subscription as Stripe.Subscription | null;
      const subStatus = sub?.status ?? "trialing";
      const stripeCustomerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? "";
      const stripeSubscriptionId = sub?.id ?? "";

      // Check if profile already updated by webhook (race condition — don't overwrite if already active)
      const profile = await getProfileByUserId(userId);
      const alreadyActive = profile?.membership === "pro" && ["active", "trialing"].includes(profile?.status ?? "");

      if (!alreadyActive) {
        await updateProfile(userId, {
          membership: "pro",
          status: subStatus,
          ...(stripeCustomerId ? { stripeCustomerId } : {}),
          ...(stripeSubscriptionId ? { stripeSubscriptionId } : {}),
        });
      }

      // Increment promo code usedCount (webhook may not have fired yet)
      const promoCode = session.metadata?.promoCode;
      if (promoCode && !alreadyActive) {
        await db
          .update(promoCodesTable)
          .set({ usedCount: sql`${promoCodesTable.usedCount} + 1` })
          .where(eq(promoCodesTable.code, promoCode))
          .catch(() => {});
      }
    }
  } catch (err) {
    // Don't block the user — webhook will catch up
    console.error("[subscribe/success] Stripe verify error:", err);
  }

  redirect("/dashboard");
}
