import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/db/db";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://contentflywheel.co.uk";

/**
 * GET /api/stripe/connect/return?userId=xxx
 * Called by Stripe after the creator completes (or abandons) onboarding.
 * Syncs their account status then redirects to the payouts dashboard.
 */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.redirect(`${baseUrl}/dashboard/store/payouts`);
  }

  try {
    const [profile] = await db
      .select({ stripeConnectAccountId: profilesTable.stripeConnectAccountId })
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .limit(1);

    if (profile?.stripeConnectAccountId) {
      const account = await stripe.accounts.retrieve(profile.stripeConnectAccountId);
      await db
        .update(profilesTable)
        .set({
          stripeConnectOnboardingComplete: account.details_submitted,
          stripeConnectChargesEnabled: account.charges_enabled,
        })
        .where(eq(profilesTable.userId, userId));
    }
  } catch (err) {
    console.error("[stripe/connect/return] error:", err);
  }

  return NextResponse.redirect(`${baseUrl}/dashboard/store/payouts?connect=done`);
}
