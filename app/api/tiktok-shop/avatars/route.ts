export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";

/**
 * GET: Returns empty avatars/voices. Video Creation Guide flow does not use AI avatars.
 * Kept for backwards compatibility with UI.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkApiRateLimit(userId);

    if (rl) return rl;

    return NextResponse.json({
      avatars: [],
      voices: [],
      available: false,
    });
  } catch (err) {
    return NextResponse.json(
      { avatars: [], voices: [], available: false },
      { status: 200 }
    );
  }
}
