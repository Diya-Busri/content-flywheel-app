import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import { profilesTable } from "@/db/schema/profiles-schema";
import { isNotNull, gte, sql, isNull, gt, and, lte } from "drizzle-orm";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  const day90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Total trial starts in last 90 days
  const [startedRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(profilesTable)
    .where(and(isNotNull(profilesTable.trialStartedAt), gte(profilesTable.trialStartedAt, day90)));

  // Trial conversions (paid after trial)
  const [convertedRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(profilesTable)
    .where(and(profilesTable.trialConverted, gte(profilesTable.trialStartedAt, day90)));

  // Cancelled during trial
  const [cancelledRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(profilesTable)
    .where(and(isNotNull(profilesTable.trialCancelledAt), gte(profilesTable.trialStartedAt, day90)));

  // Currently in trial (trial not ended, not cancelled)
  const [inTrialRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(profilesTable)
    .where(
      and(
        isNotNull(profilesTable.trialStartedAt),
        isNull(profilesTable.trialCancelledAt),
        gt(profilesTable.trialEndsAt, now),
      )
    );

  // Trial expiries: ended, not cancelled, not converted (just let it lapse silently)
  const [lapsedRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(profilesTable)
    .where(
      and(
        isNotNull(profilesTable.trialStartedAt),
        isNull(profilesTable.trialCancelledAt),
        lte(profilesTable.trialEndsAt, now),
        sql`${profilesTable.trialConverted} = false`,
        gte(profilesTable.trialStartedAt, day90),
      )
    );

  // Cancellation by day of trial (0 = same day, 1 = day 1, etc.)
  const cancelByDay = await db.execute<{ day: number; count: number }>(sql`
    SELECT
      LEAST(FLOOR(EXTRACT(EPOCH FROM (trial_cancelled_at - trial_started_at)) / 86400), 7)::int AS day,
      COUNT(*)::int AS count
    FROM profiles
    WHERE trial_cancelled_at IS NOT NULL
      AND trial_started_at IS NOT NULL
      AND trial_started_at >= ${day90}
    GROUP BY day
    ORDER BY day
  `);

  // Recent trial cancellations (most useful for "who cancelled immediately")
  const recentCancellations = await db.execute<{
    user_id: string;
    email: string | null;
    trial_started_at: string;
    trial_cancelled_at: string;
    days_elapsed: number;
  }>(sql`
    SELECT
      user_id,
      email,
      trial_started_at,
      trial_cancelled_at,
      FLOOR(EXTRACT(EPOCH FROM (trial_cancelled_at - trial_started_at)) / 86400)::int AS days_elapsed
    FROM profiles
    WHERE trial_cancelled_at IS NOT NULL
      AND trial_started_at IS NOT NULL
    ORDER BY trial_cancelled_at DESC
    LIMIT 30
  `);

  // Current trial users (ending soonest first)
  const currentTrialUsers = await db.execute<{
    user_id: string;
    email: string | null;
    trial_started_at: string;
    trial_ends_at: string;
    days_remaining: number;
    days_in: number;
  }>(sql`
    SELECT
      user_id,
      email,
      trial_started_at,
      trial_ends_at,
      CEIL(EXTRACT(EPOCH FROM (trial_ends_at - NOW())) / 86400)::int AS days_remaining,
      FLOOR(EXTRACT(EPOCH FROM (NOW() - trial_started_at)) / 86400)::int AS days_in
    FROM profiles
    WHERE trial_started_at IS NOT NULL
      AND trial_ends_at > NOW()
      AND trial_cancelled_at IS NULL
    ORDER BY trial_ends_at ASC
    LIMIT 25
  `);

  // Daily trial starts for sparkline (last 30 days)
  const dailyStarts = await db.execute<{ day: string; count: number }>(sql`
    SELECT DATE(trial_started_at) AS day, COUNT(*)::int AS count
    FROM profiles
    WHERE trial_started_at >= ${new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)}
    GROUP BY DATE(trial_started_at)
    ORDER BY DATE(trial_started_at)
  `);

  const started = Number(startedRow?.count ?? 0);
  const converted = Number(convertedRow?.count ?? 0);
  const cancelled = Number(cancelledRow?.count ?? 0);
  const inTrial = Number(inTrialRow?.count ?? 0);
  const lapsed = Number(lapsedRow?.count ?? 0);
  const conversionRate = started > 0 ? Math.round((converted / started) * 100) : 0;
  const cancellationRate = started > 0 ? Math.round((cancelled / started) * 100) : 0;

  return NextResponse.json({
    summary: { started, converted, cancelled, inTrial, lapsed, conversionRate, cancellationRate },
    cancelByDay: (cancelByDay.rows ?? []).map((r) => ({ day: Number(r.day), count: Number(r.count) })),
    recentCancellations: (recentCancellations.rows ?? []).map((r) => ({
      userId: String(r.user_id),
      email: r.email ? String(r.email) : null,
      trialStartedAt: String(r.trial_started_at),
      trialCancelledAt: String(r.trial_cancelled_at),
      daysElapsed: Number(r.days_elapsed),
    })),
    currentTrialUsers: (currentTrialUsers.rows ?? []).map((r) => ({
      userId: String(r.user_id),
      email: r.email ? String(r.email) : null,
      trialStartedAt: String(r.trial_started_at),
      trialEndsAt: String(r.trial_ends_at),
      daysRemaining: Number(r.days_remaining),
      daysIn: Number(r.days_in),
    })),
    dailyStarts: (dailyStarts.rows ?? []).map((r) => ({ day: String(r.day), count: Number(r.count) })),
  });
}
