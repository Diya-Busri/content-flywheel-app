/**
 * GET /api/creator-acceptance/my-invites
 * Returns all creator applications that were referred by the current user.
 * Auth required.
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { creatorApplicationsTable } from "@/db/schema/creator-applications-schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const applications = await db
      .select({
        id: creatorApplicationsTable.id,
        name: creatorApplicationsTable.name,
        email: creatorApplicationsTable.email,
        platform: creatorApplicationsTable.platform,
        niche: creatorApplicationsTable.niche,
        followerCount: creatorApplicationsTable.followerCount,
        goal: creatorApplicationsTable.goal,
        status: creatorApplicationsTable.status,
        createdAt: creatorApplicationsTable.createdAt,
      })
      .from(creatorApplicationsTable)
      .where(eq(creatorApplicationsTable.referrerUserId, userId))
      .orderBy(desc(creatorApplicationsTable.createdAt));

    return NextResponse.json({ applications });
  } catch (err) {
    console.error("[creator-acceptance/my-invites]", err);
    return NextResponse.json({ applications: [] });
  }
}
