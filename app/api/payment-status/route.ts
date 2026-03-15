import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getProfileByUserId } from "@/db/queries/profiles-queries";

/**
 * GET /api/payment-status
 * Returns whether the current user's subscription payment has failed.
 * Used by PaymentStatusAlert so it does not rely on server actions (which can 404 on some routes).
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ paymentFailed: false }, { status: 200 });
    }
    const profile = await getProfileByUserId(userId);
    const paymentFailed = profile?.status === "payment_failed" || false;
    return NextResponse.json({ paymentFailed });
  } catch (error) {
    console.error("[payment-status] Error:", error);
    return NextResponse.json({ paymentFailed: false }, { status: 200 });
  }
}
