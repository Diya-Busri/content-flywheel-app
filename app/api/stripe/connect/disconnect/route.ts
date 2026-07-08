export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq } from "drizzle-orm";

/**
 * DELETE /api/stripe/connect/disconnect
 * Clears the Stripe Connect account from the creator's profile.
 * Note: this does NOT close the Stripe account — the creator keeps their
 * Stripe Express account but it is de-linked from Content Flywheel.
 */
export async function DELETE() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await db
      .update(profilesTable)
      .set({
        stripeConnectAccountId:       null,
        stripeConnectOnboardingComplete: false,
        stripeConnectChargesEnabled:  false,
        stripeConnectPayoutsEnabled:  false,
      })
      .where(eq(profilesTable.userId, userId));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[stripe/connect/disconnect] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to disconnect" },
      { status: 500 }
    );
  }
}
