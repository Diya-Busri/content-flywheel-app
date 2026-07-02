export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { db } from "@/db/db";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://contentflywheel.co.uk";

/**
 * POST /api/stripe/connect/onboard
 * Creates (or retrieves) a Stripe Connect Express account for the creator
 * and returns an account link URL to start/resume onboarding.
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch current profile
    const [profile] = await db
      .select({
        email: profilesTable.email,
        stripeConnectAccountId: profilesTable.stripeConnectAccountId,
      })
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .limit(1);

    let accountId = profile?.stripeConnectAccountId;

    // Create a new Express account if one doesn't exist yet
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: profile?.email ?? undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { contentFlyWheelUserId: userId },
      });

      accountId = account.id;

      await db
        .update(profilesTable)
        .set({ stripeConnectAccountId: accountId })
        .where(eq(profilesTable.userId, userId));
    }

    // Create a fresh account link (they expire, so always regenerate)
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/api/stripe/connect/onboard`,
      return_url: `${baseUrl}/api/stripe/connect/return?userId=${userId}`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (err) {
    console.error("[stripe/connect/onboard] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to start Stripe onboarding" },
      { status: 500 }
    );
  }
}
