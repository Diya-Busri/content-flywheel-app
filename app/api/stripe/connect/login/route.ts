export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { db } from "@/db/db";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * POST /api/stripe/connect/login
 * Creates an Express dashboard login link so a connected creator can manage
 * their Stripe account (payouts, bank details, etc.).
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [profile] = await db
      .select({ stripeConnectAccountId: profilesTable.stripeConnectAccountId })
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .limit(1);

    if (!profile?.stripeConnectAccountId) {
      return NextResponse.json({ error: "No Stripe account connected" }, { status: 400 });
    }

    const loginLink = await stripe.accounts.createLoginLink(profile.stripeConnectAccountId);
    return NextResponse.json({ url: loginLink.url });
  } catch (err) {
    console.error("[stripe/connect/login] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create login link" },
      { status: 500 }
    );
  }
}
