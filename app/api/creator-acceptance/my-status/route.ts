/**
 * GET /api/creator-acceptance/my-status
 * Returns the current logged-in user's application status.
 * Matches by clerkUserId first, then by email.
 */
import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { creatorApplicationsTable } from "@/db/schema/creator-applications-schema";
import { eq, or } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase() ?? "";

    const [row] = await db
      .select({
        id: creatorApplicationsTable.id,
        status: creatorApplicationsTable.status,
        name: creatorApplicationsTable.name,
        email: creatorApplicationsTable.email,
        followerCount: creatorApplicationsTable.followerCount,
        platform: creatorApplicationsTable.platform,
        niche: creatorApplicationsTable.niche,
        createdAt: creatorApplicationsTable.createdAt,
      })
      .from(creatorApplicationsTable)
      .where(
        or(
          eq(creatorApplicationsTable.clerkUserId, userId),
          ...(email ? [eq(creatorApplicationsTable.email, email)] : [])
        )
      )
      .limit(1);

    if (!row) return NextResponse.json({ status: "none" });

    return NextResponse.json({ status: row.status, application: row });
  } catch (err) {
    console.error("[creator-acceptance/my-status]", err);
    return NextResponse.json({ status: "none" });
  }
}
