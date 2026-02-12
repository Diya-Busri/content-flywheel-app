import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { goalsTable } from "@/db/schema/goals-schema";
import { eq, and } from "drizzle-orm";

/**
 * Advance to next day and break streak (e.g. user opened app after 2am grace period).
 * Client should only call when they've determined grace has ended.
 */
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

    const nextDay = Math.min(goal.totalDays, goal.currentDay + 1);
    const isGoalComplete = nextDay > goal.totalDays;
    const now = new Date();

    await db
      .update(goalsTable)
      .set({
        currentDay: nextDay,
        streakCount: 0,
        status: isGoalComplete ? "completed" : goal.status,
        updatedAt: now,
      })
      .where(eq(goalsTable.id, goalId));

    return NextResponse.json({
      ok: true,
      currentDay: nextDay,
      streakCount: 0,
      completed: isGoalComplete,
    });
  } catch (err) {
    console.error("Advance past grace error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to advance" },
      { status: 500 }
    );
  }
}
