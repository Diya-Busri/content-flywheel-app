import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createProfile, getProfileByUserId } from "@/db/queries/profiles-queries";

/**
 * Debug route: tries profile creation and returns the actual error.
 * Visit /api/debug-profile while signed in.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Not signed in", userId: null });
    }

    // Check if profile already exists
    const existing = await getProfileByUserId(userId);
    if (existing) {
      return NextResponse.json({
        ok: true,
        message: "Profile already exists",
        profile: { userId: existing.userId, email: existing.email },
      });
    }

    // Try to create profile directly to capture the real error
    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress;
    const newProfile = await createProfile(email ? { userId, email } : { userId });

    return NextResponse.json({
      ok: true,
      message: "Profile created successfully",
      profile: { userId: newProfile.userId },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    const cause = err instanceof Error && err.cause ? String(err.cause) : undefined;
    return NextResponse.json({
      ok: false,
      error: message,
      cause,
      stack: stack?.split("\n").slice(0, 8),
    });
  }
}
