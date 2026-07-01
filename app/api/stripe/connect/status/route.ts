import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { db } from "@/db/db";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const dynamic = "force-dynamic";

/**
 * GET /api/stripe/connect/status
 * Returns the creator's Stripe Connect status.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [profile] = await db
      .select({
        stripeConnectAccountId: profilesTable.stripeConnectAccountId,
        stripeConnectOnboardingComplete: profilesTable.stripeConnectOnboardingComplete,
        stripeConnectChargesEnabled: profilesTable.stripeConnectChargesEnabled,
      })
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .limit(1);

    if (!profile?.stripeConnectAccountId) {
      return NextResponse.json({ connected: false, chargesEnabled: false });
    }

    // Live-check with Stripe in case the account was updated outside of webhooks
    const account = await stripe.accounts.retrieve(profile.stripeConnectAccountId);
    const chargesEnabled = account.charges_enabled;
    const detailsSubmitted = account.details_submitted;

    // Sync to DB if state has changed
    if (
      chargesEnabled !== profile.stripeConnectChargesEnabled ||
      detailsSubmitted !== profile.stripeConnectOnboardingComplete
    ) {
      await db
        .update(profilesTable)
        .set({
          stripeConnectChargesEnabled: chargesEnabled,
          stripeConnectOnboardingComplete: detailsSubmitted,
        })
        .where(eq(profilesTable.userId, userId));
    }

    return NextResponse.json({
      connected: true,
      accountId: profile.stripeConnectAccountId,
      onboardingComplete: detailsSubmitted,
      chargesEnabled,
    });
  } catch (err) {
    console.error("[stripe/connect/status] error:", err);
    return NextResponse.json({ error: "Failed to fetch connect status" }, { status: 500 });
  }
}
