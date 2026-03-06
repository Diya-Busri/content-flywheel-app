import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { goalsTable, dailyTasksTable, type TaskCategory } from "@/db/schema/goals-schema";
import { TASK_CATEGORIES } from "@/lib/goals/categories";
import { generateTasks } from "@/lib/goals/generate-tasks";
import { eq, and } from "drizzle-orm";

function durationStringToMinutes(s: string): number {
  const m = s.match(/^(\d+)\s*min$/i);
  if (m) return parseInt(m[1], 10) || 30;
  const h = s.match(/^(\d+)\s*hr/i);
  if (h) return (parseInt(h[1], 10) || 1) * 60;
  return 30;
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

    const currentDay = goal.currentDay;
    const now = new Date();

    const dayTasks = await db
      .select({
        id: dailyTasksTable.id,
        proofRequired: dailyTasksTable.proofRequired,
        proofSubmittedAt: dailyTasksTable.proofSubmittedAt,
      })
      .from(dailyTasksTable)
      .where(
        and(
          eq(dailyTasksTable.goalId, goalId),
          eq(dailyTasksTable.dayNumber, currentDay)
        )
      );
    const missingProof = dayTasks.some(
      (t) => t.proofRequired && !t.proofSubmittedAt
    );
    if (missingProof) {
      return NextResponse.json(
        { error: "All tasks with proof required must have proof submitted before completing the day." },
        { status: 400 }
      );
    }

    await db
      .update(dailyTasksTable)
      .set({ isCompleted: true, completedAt: now })
      .where(
        and(
          eq(dailyTasksTable.goalId, goalId),
          eq(dailyTasksTable.dayNumber, currentDay)
        )
      );

    const newStreak = goal.streakCount + 1;
    const newLongest = Math.max(goal.longestStreak, newStreak);
    const nextDay = Math.min(goal.totalDays, currentDay + 1);
    const isGoalComplete = nextDay > goal.totalDays;

    await db
      .update(goalsTable)
      .set({
        currentDay: nextDay,
        streakCount: newStreak,
        longestStreak: newLongest,
        status: isGoalComplete ? "completed" : goal.status,
        updatedAt: now,
      })
      .where(eq(goalsTable.id, goalId));

    if (!isGoalComplete && nextDay <= goal.totalDays) {
      const nextDayExisting = await db
        .select({ id: dailyTasksTable.id })
        .from(dailyTasksTable)
        .where(
          and(
            eq(dailyTasksTable.goalId, goalId),
            eq(dailyTasksTable.dayNumber, nextDay)
          )
        )
        .limit(1);
      if (nextDayExisting.length === 0) {
        try {
          const mins = goal.dailyTimeCommitment ?? 60;
          const dailyTimeStr =
            mins <= 30 ? "30min"
            : mins <= 60 ? "1hr"
            : mins <= 120 ? "2hr"
            : mins <= 180 ? "3hr"
            : "4hr+";
          const generated = await generateTasks({
            title: goal.title,
            description: goal.description ?? undefined,
            totalDays: goal.totalDays,
            dailyTimeCommitment: dailyTimeStr,
            daysToGenerate: [nextDay],
          });
          const taskRows = generated.map((t, i) => ({
            goalId,
            dayNumber: t.dayNumber,
            taskDescription: t.taskDescription.slice(0, 500),
            estimatedDuration: durationStringToMinutes(t.duration),
            howToComplete: t.howToComplete ? t.howToComplete.slice(0, 2000) : null,
            orderIndex: i,
            taskType: t.taskType === "app_action" ? "app_action" as const : "external" as const,
            appLink: t.appLink ?? null,
            appLabel: t.appLabel ?? null,
            category:
              (t.category && (TASK_CATEGORIES as readonly string[]).includes(t.category) ? t.category : null) as TaskCategory | null,
          }));
          await db.insert(dailyTasksTable).values(taskRows);
        } catch (err) {
          console.error("Failed to generate Day", nextDay, "tasks:", err);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      currentDay: nextDay,
      streakCount: newStreak,
      completed: isGoalComplete,
    });
  } catch (err) {
    console.error("Complete day error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to complete day" },
      { status: 500 }
    );
  }
}
