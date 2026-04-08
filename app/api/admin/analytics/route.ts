import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import { userEventsTable } from "@/db/schema/user-events-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { gte, desc, count, sql } from "drizzle-orm";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  const day1 = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
  const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // DAU / WAU / MAU — distinct users with events
  const [dauRow] = await db
    .select({ count: sql<number>`COUNT(DISTINCT user_id)` })
    .from(userEventsTable)
    .where(gte(userEventsTable.createdAt, day1));

  const [wauRow] = await db
    .select({ count: sql<number>`COUNT(DISTINCT user_id)` })
    .from(userEventsTable)
    .where(gte(userEventsTable.createdAt, day7));

  const [mauRow] = await db
    .select({ count: sql<number>`COUNT(DISTINCT user_id)` })
    .from(userEventsTable)
    .where(gte(userEventsTable.createdAt, day30));

  // Top events by count (last 30 days)
  const topEvents = await db
    .select({ event: userEventsTable.event, count: count() })
    .from(userEventsTable)
    .where(gte(userEventsTable.createdAt, day30))
    .groupBy(userEventsTable.event)
    .orderBy(desc(count()))
    .limit(15);

  // Most active users (last 30 days)
  const topUsers = await db
    .select({ userId: userEventsTable.userId, count: count() })
    .from(userEventsTable)
    .where(gte(userEventsTable.createdAt, day30))
    .groupBy(userEventsTable.userId)
    .orderBy(desc(count()))
    .limit(10);

  // Enrich with emails
  const userIds = topUsers.map((u) => u.userId);
  const profiles = userIds.length
    ? await db.select({ userId: profilesTable.userId, email: profilesTable.email }).from(profilesTable)
    : [];
  const emailMap = Object.fromEntries(profiles.map((p) => [p.userId, p.email ?? p.userId]));

  // Daily event counts for sparkline (last 14 days)
  const dailyEvents = await db
    .select({
      day: sql<string>`DATE(created_at)`,
      count: count(),
    })
    .from(userEventsTable)
    .where(gte(userEventsTable.createdAt, new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)))
    .groupBy(sql`DATE(created_at)`)
    .orderBy(sql`DATE(created_at)`);

  // Recently active users
  const recentlyActive = await db
    .select({ userId: profilesTable.userId, email: profilesTable.email, lastActiveAt: profilesTable.lastActiveAt, membership: profilesTable.membership })
    .from(profilesTable)
    .where(gte(profilesTable.lastActiveAt, day7))
    .orderBy(desc(profilesTable.lastActiveAt))
    .limit(20);

  return NextResponse.json({
    dau: Number(dauRow?.count ?? 0),
    wau: Number(wauRow?.count ?? 0),
    mau: Number(mauRow?.count ?? 0),
    topEvents,
    topUsers: topUsers.map((u) => ({ ...u, email: emailMap[u.userId] ?? u.userId })),
    dailyEvents,
    recentlyActive,
  });
}
