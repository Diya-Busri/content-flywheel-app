export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import {
  goalsTable,
  dailyTasksTable,
  goalWeeklyReviewsTable,
} from "@/db/schema/goals-schema";
import { eq, and, asc, gte, sql, isNotNull } from "drizzle-orm";

/** Monday 00:00:00 UTC for the week containing date d. */
function getWeekStart(d: Date): Date {
  const x = new Date(d);
  const day = x.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  x.setUTCDate(x.getUTCDate() - diff);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function toYYYYMMDD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(
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
    const weekStart = getWeekStart(now);
    const weekStartStr = toYYYYMMDD(weekStart);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

    const tasksWithProofThisWeek = await db
      .select({
        id: dailyTasksTable.id,
        dayNumber: dailyTasksTable.dayNumber,
        taskDescription: dailyTasksTable.taskDescription,
        proofType: dailyTasksTable.proofType,
        proofUrl: dailyTasksTable.proofUrl,
        proofText: dailyTasksTable.proofText,
        proofDescription: dailyTasksTable.proofDescription,
        proofSubmittedAt: dailyTasksTable.proofSubmittedAt,
        proofValidationStatus: dailyTasksTable.proofValidationStatus,
      })
      .from(dailyTasksTable)
      .where(
        and(
          eq(dailyTasksTable.goalId, goalId),
          isNotNull(dailyTasksTable.proofSubmittedAt),
          gte(dailyTasksTable.proofSubmittedAt, weekStart),
          sql`${dailyTasksTable.proofSubmittedAt} < ${weekEnd}`
        )
      )
      .orderBy(asc(dailyTasksTable.dayNumber));

    const [reviewRow] = await db
      .select()
      .from(goalWeeklyReviewsTable)
      .where(
        and(
          eq(goalWeeklyReviewsTable.goalId, goalId),
          eq(goalWeeklyReviewsTable.weekStartDate, weekStartStr)
        )
      );

    const tasks = tasksWithProofThisWeek.map((t) => ({
      id: t.id,
      dayNumber: t.dayNumber,
      taskDescription: t.taskDescription,
      proofType: t.proofType ?? undefined,
      proofUrl: t.proofUrl ?? undefined,
      proofText: t.proofText ?? undefined,
      proofDescription: t.proofDescription ?? undefined,
      proofSubmittedAt: (t.proofSubmittedAt as Date)?.toISOString?.() ?? undefined,
      proofValidationStatus: t.proofValidationStatus ?? undefined,
    }));

    const targetDate = new Date((goal.targetDate as Date).getTime());
    const startDate = new Date(targetDate);
    startDate.setDate(targetDate.getDate() - (goal.totalDays - 1));

    return NextResponse.json({
      goal: {
        id: goal.id,
        title: goal.title,
        totalDays: goal.totalDays,
        startDate: startDate.toISOString().slice(0, 10),
      },
      weekStartDate: weekStartStr,
      tasks,
      honestyCheckedForWeek: !!reviewRow,
      checkedAt: reviewRow?.checkedAt
        ? (reviewRow.checkedAt as Date).toISOString()
        : undefined,
    });
  } catch (err) {
    console.error("Review GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load review" },
      { status: 500 }
    );
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: goalId } = await params;
    if (!goalId) return NextResponse.json({ error: "Goal ID required" }, { status: 400 });

    const [goal] = await db
      .select({ id: goalsTable.id })
      .from(goalsTable)
      .where(and(eq(goalsTable.id, goalId), eq(goalsTable.userId, userId)));

    if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 });

    const now = new Date();
    const weekStartStr = toYYYYMMDD(getWeekStart(now));

    await db
      .insert(goalWeeklyReviewsTable)
      .values({
        goalId,
        weekStartDate: weekStartStr,
      })
      .onConflictDoUpdate({
        target: [goalWeeklyReviewsTable.goalId, goalWeeklyReviewsTable.weekStartDate],
        set: { checkedAt: new Date() },
      });

    return NextResponse.json({
      ok: true,
      weekStartDate: weekStartStr,
    });
  } catch (err) {
    console.error("Review POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save review" },
      { status: 500 }
    );
  }
}
