import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

/**
 * GET: Returns empty avatars/voices (Shotstack does not use AI avatars).
 * Kept for backwards compatibility with UI.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
