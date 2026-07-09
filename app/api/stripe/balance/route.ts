import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { db } from "@/db/db";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Look up this creator's Stripe Connect account ID
    const [profile] = await db
      .select({ stripeConnectAccountId: profilesTable.stripeConnectAccountId })
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .limit(1);

    const accountId = profile?.stripeConnectAccountId;

    if (!accountId) {
      return NextResponse.json({ error: "No Stripe account connected" }, { status: 404 });
    }

    // Retrieve balance FOR the creator's connected account (not the platform)
    const balance = await stripe.balance.retrieve(
      {},
      { stripeAccount: accountId }
    );

    return NextResponse.json({
      available: balance.available,
      pending: balance.pending,
    });
  } catch (err) {
    console.error("[stripe/balance] GET error:", err);
    return NextResponse.json({ error: "Failed to retrieve balance" }, { status: 500 });
  }
}
