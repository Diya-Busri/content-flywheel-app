/**
 * GET /api/creator-acceptance/verify-invite?token=...
 * Checks if an invite token is valid (accepted application, token not yet used).
 * Returns: { valid: boolean; name?: string; email?: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { creatorApplicationsTable } from "@/db/schema/creator-applications-schema";
import { eq, and, isNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (!token) return NextResponse.json({ valid: false });

  try {
    const [row] = await db
      .select({
        id: creatorApplicationsTable.id,
        name: creatorApplicationsTable.name,
        email: creatorApplicationsTable.email,
        status: creatorApplicationsTable.status,
        clerkUserId: creatorApplicationsTable.clerkUserId,
      })
      .from(creatorApplicationsTable)
      .where(
        and(
          eq(creatorApplicationsTable.inviteToken, token),
          eq(creatorApplicationsTable.status, "accepted"),
          isNull(creatorApplicationsTable.clerkUserId) // not yet used
        )
      )
      .limit(1);

    if (!row) return NextResponse.json({ valid: false });
    return NextResponse.json({ valid: true, name: row.name, email: row.email });
  } catch (err) {
    console.error("[creator-acceptance/verify-invite]", err);
    return NextResponse.json({ valid: false });
  }
}

/**
 * POST /api/creator-acceptance/verify-invite
 * Called after sign-up to link the Clerk userId to the application and invalidate the token.
 * Body: { token: string; clerkUserId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const clerkUserId = typeof body.clerkUserId === "string" ? body.clerkUserId.trim() : "";

    if (!token || !clerkUserId) return NextResponse.json({ ok: false });

    const [row] = await db
      .select({ id: creatorApplicationsTable.id })
      .from(creatorApplicationsTable)
      .where(
        and(
          eq(creatorApplicationsTable.inviteToken, token),
          eq(creatorApplicationsTable.status, "accepted"),
          isNull(creatorApplicationsTable.clerkUserId)
        )
      )
      .limit(1);

    if (!row) return NextResponse.json({ ok: false });

    await db
      .update(creatorApplicationsTable)
      .set({ clerkUserId })
      .where(eq(creatorApplicationsTable.id, row.id));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[creator-acceptance/verify-invite POST]", err);
    return NextResponse.json({ ok: false });
  }
}
