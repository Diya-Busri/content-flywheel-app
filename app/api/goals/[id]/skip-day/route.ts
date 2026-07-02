export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { goalsTable } from "@/db/schema/goals-schema";
import { eq, and } from "drizzle-orm";

/** Monday 00:00 UTC of the week containing d */
function getWeekStart(d: Date): Date {
  const du = new Date(d);
  const day = du.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  du.setUTCDate(du.getUTCDate() - diff);
  du.setUTCHours(0, 0, 0, 0);
  return du;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: goalId } = await params;
    if (!goalId) return NextResponse.json({ error: "Goal ID required" }, { status: 400 });

    const [goal] = await db
      .select()
      .from(goalsTable)
      .where(and(eq(goalsTable.id, goalId), eq(goalsTable.userId, userId)));
    if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 });

    const now = new Date();
    const thisWeekStart = getWeekStart(now);
    const lastSkipped = goal.lastSkippedAt ? new Date(goal.lastSkippedAt as Date) : null;
    const hasToken =
      !lastSkipped || lastSkipped < thisWeekStart;

    if (!hasToken) {
      return NextResponse.json(
        { error: "You've already used your 1 skip this week. Skip resets Monday." },
        { status: 400 }
      );
    }

    const currentDay = goal.currentDay;
    const nextDay = Math.min(goal.totalDays, currentDay + 1);
    const isGoalComplete = nextDay > goal.totalDays;

    await db
      .update(goalsTable)
      .set({
        currentDay: nextDay,
        lastSkippedAt: now,
        status: isGoalComplete ? "completed" : goal.status,
        updatedAt: now,
      })
      .where(eq(goalsTable.id, goalId));

    return NextResponse.json({
      ok: true,
      currentDay: nextDay,
      streakCount: goal.streakCount,
      completed: isGoalComplete,
    });
  } catch (err) {
    console.error("Skip day error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to skip day" },
      { status: 500 }
    );
  }
}
