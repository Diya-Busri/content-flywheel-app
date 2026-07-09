import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Require authenticated user for API routes.
 * Call at the top of every API route that must be user-only.
 * @returns [userId, null] if authenticated, or [null, 401 NextResponse] if not
 */
export async function requireAuth(): Promise<[string, null] | [null, NextResponse]> {
  const { userId } = await auth();
  if (!userId || typeof userId !== "string") {
    return [
      null,
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    ];
  }
  return [userId, null];
}
