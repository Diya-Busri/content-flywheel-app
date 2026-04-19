/**
 * GET /api/video-credits/balance
 * Returns the current user's video credit balance.
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getProfileByUserId } from "@/db/queries/profiles-queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const profile = await getProfileByUserId(userId);
    return NextResponse.json({ balance: profile?.videoCredits ?? 0 });
  } catch (err) {
    console.error("[video-credits/balance]", err);
    // Return 500 so the client can distinguish "definitely 0 credits" from "couldn't check"
    return NextResponse.json({ error: "Failed to fetch balance" }, { status: 500 });
  }
}
