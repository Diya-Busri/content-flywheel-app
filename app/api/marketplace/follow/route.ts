import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { creatorFollowsTable } from "@/db/schema/creator-follows-schema";
import { notificationsTable } from "@/db/schema/notifications-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq, and, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/marketplace/follow?creatorId=xxx
 * Returns { following: boolean, followerCount: number }
 * If no creatorId, returns { followingIds: string[] } — all creator IDs the user follows.
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  const creatorId = new URL(req.url).searchParams.get("creatorId");

  if (creatorId) {
    // Check follow status + follower count for a specific creator
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(creatorFollowsTable)
      .where(eq(creatorFollowsTable.followedId, creatorId));

    const followerCount = countRow?.count ?? 0;

    if (!userId) return NextResponse.json({ following: false, followerCount });

    const [existingRow] = await db
      .select({ id: creatorFollowsTable.id })
      .from(creatorFollowsTable)
      .where(and(eq(creatorFollowsTable.followerId, userId), eq(creatorFollowsTable.followedId, creatorId)))
      .limit(1);

    return NextResponse.json({ following: !!existingRow, followerCount });
  }

  // No creatorId — return all creator IDs the authenticated user follows
  if (!userId) return NextResponse.json({ followingIds: [] });

  const rows = await db
    .select({ followedId: creatorFollowsTable.followedId })
    .from(creatorFollowsTable)
    .where(eq(creatorFollowsTable.followerId, userId));

  return NextResponse.json({ followingIds: rows.map((r) => r.followedId) });
}

/**
 * POST /api/marketplace/follow  { creatorId }
 * Follow a creator. Sends them a notification.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { creatorId } = await req.json().catch(() => ({}));
  if (!creatorId) return NextResponse.json({ error: "creatorId required" }, { status: 400 });
  if (creatorId === userId) return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });

  // Upsert follow
  try {
    await db.insert(creatorFollowsTable).values({ followerId: userId, followedId: creatorId }).onConflictDoNothing();
  } catch {
    // duplicate — already following
  }

  // Notify the creator (fire and forget)
  try {
    // Get follower's display email for the notification
    const [followerProfile] = await db
      .select({ email: profilesTable.email })
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .limit(1);
    const followerLabel = followerProfile?.email?.split("@")[0] ?? "Someone";

    await db.insert(notificationsTable).values({
      userId: creatorId,
      title: "New follower",
      message: `${followerLabel} started following you.`,
      type: "info",
      linkUrl: `/marketplace/creator/${userId}`,
      metadata: { followerId: userId },
    });
  } catch { /* non-critical */ }

  // Return new follower count
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(creatorFollowsTable)
    .where(eq(creatorFollowsTable.followedId, creatorId));

  return NextResponse.json({ ok: true, followerCount: countRow?.count ?? 0 });
}

/**
 * DELETE /api/marketplace/follow?creatorId=xxx
 * Unfollow a creator.
 */
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const creatorId = new URL(req.url).searchParams.get("creatorId");
  if (!creatorId) return NextResponse.json({ error: "creatorId required" }, { status: 400 });

  await db
    .delete(creatorFollowsTable)
    .where(and(eq(creatorFollowsTable.followerId, userId), eq(creatorFollowsTable.followedId, creatorId)));

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(creatorFollowsTable)
    .where(eq(creatorFollowsTable.followedId, creatorId));

  return NextResponse.json({ ok: true, followerCount: countRow?.count ?? 0 });
}
