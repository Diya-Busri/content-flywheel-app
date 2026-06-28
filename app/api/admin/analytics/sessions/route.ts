import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import { pageSessionsTable } from "@/db/schema/page-sessions-schema";
import { gte, sql, and, gt } from "drizzle-orm";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  const day1 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const live5m = new Date(now.getTime() - 5 * 60 * 1000);

  // Visit counts
  const [todayRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(pageSessionsTable)
    .where(gte(pageSessionsTable.startedAt, day1));

  const [weekRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(pageSessionsTable)
    .where(gte(pageSessionsTable.startedAt, day7));

  const [monthRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(pageSessionsTable)
    .where(gte(pageSessionsTable.startedAt, day30));

  // Avg duration and pages per session (last 30 days, only sessions > 5s)
  const [avgRow] = await db
    .select({
      avgDuration: sql<number>`ROUND(AVG(duration_seconds))`,
      avgPages: sql<number>`ROUND(AVG(page_views), 1)`,
    })
    .from(pageSessionsTable)
    .where(and(gte(pageSessionsTable.startedAt, day30), gt(pageSessionsTable.durationSeconds, 5)));

  // Live visitors (last ping within 5 min)
  const liveRows = await db
    .select({
      sessionId: pageSessionsTable.sessionId,
      userId: pageSessionsTable.userId,
      entryPage: pageSessionsTable.entryPage,
      pages: pageSessionsTable.pages,
      durationSeconds: pageSessionsTable.durationSeconds,
      startedAt: pageSessionsTable.startedAt,
      device: pageSessionsTable.device,
    })
    .from(pageSessionsTable)
    .where(gte(pageSessionsTable.lastPingAt, live5m))
    .limit(20);

  // Top pages (unnest JSON array, last 30 days)
  const topPages = await db.execute<{ page: string; views: number }>(sql`
    SELECT page, COUNT(*) AS views
    FROM page_sessions, jsonb_array_elements_text(pages) AS page
    WHERE started_at >= ${day30}
    GROUP BY page
    ORDER BY views DESC
    LIMIT 10
  `);

  // Device breakdown (last 30 days)
  const deviceRows = await db
    .select({ device: pageSessionsTable.device, count: sql<number>`COUNT(*)` })
    .from(pageSessionsTable)
    .where(gte(pageSessionsTable.startedAt, day30))
    .groupBy(pageSessionsTable.device);

  // New vs returning (last 30 days)
  const newVsReturning = await db
    .select({ isNew: pageSessionsTable.isNew, count: sql<number>`COUNT(*)` })
    .from(pageSessionsTable)
    .where(gte(pageSessionsTable.startedAt, day30))
    .groupBy(pageSessionsTable.isNew);

  // Daily visit sparkline (last 14 days)
  const dailyVisits = await db.execute<{ day: string; count: number }>(sql`
    SELECT DATE(started_at) AS day, COUNT(*) AS count
    FROM page_sessions
    WHERE started_at >= ${new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)}
    GROUP BY DATE(started_at)
    ORDER BY DATE(started_at)
  `);

  return NextResponse.json({
    visits: {
      today: Number(todayRow?.count ?? 0),
      thisWeek: Number(weekRow?.count ?? 0),
      thisMonth: Number(monthRow?.count ?? 0),
    },
    avgDurationSeconds: Number(avgRow?.avgDuration ?? 0),
    avgPageViews: Number(avgRow?.avgPages ?? 0),
    liveVisitors: liveRows.map((r) => ({
      ...r,
      currentPage: Array.isArray(r.pages) && r.pages.length > 0 ? r.pages[r.pages.length - 1] : r.entryPage,
    })),
    topPages: (topPages.rows ?? []).map((r) => ({ page: String(r.page), views: Number(r.views) })),
    deviceBreakdown: deviceRows.map((r) => ({ device: r.device ?? "unknown", count: Number(r.count) })),
    newVsReturning: newVsReturning.map((r) => ({ isNew: r.isNew, count: Number(r.count) })),
    dailyVisits: (dailyVisits.rows ?? []).map((r) => ({ day: String(r.day), count: Number(r.count) })),
  });
}
