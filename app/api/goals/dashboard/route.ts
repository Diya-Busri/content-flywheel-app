import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { goalsTable, dailyTasksTable } from "@/db/schema/goals-schema";
import { eq, inArray, desc, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const goals = await db
      .select()
      .from(goalsTable)
      .where(eq(goalsTable.userId, userId))
      .orderBy(desc(goalsTable.createdAt));

    const activeGoals = goals.filter(
      (g) => g.status === "active" || g.status === "paused"
    );
    const activeGoalIds = activeGoals.map((g) => g.id);

    let tasksByGoalId: Record<
      string,
      {
        today: Array<{
          id: string;
          taskDescription: string;
          estimatedDuration?: number;
          isCompleted: boolean;
          dayNumber: number;
          proofRequired?: boolean;
          proofSubmittedAt?: string | null;
          taskType?: string;
          appLink?: string | null;
          category?: string | null;
        }>;
        tomorrow: Array<{
          id: string;
          taskDescription: string;
          estimatedDuration?: number;
          isCompleted: boolean;
          dayNumber: number;
        }>;
        completedDays: number[];
      }
    > = {};

    if (activeGoalIds.length > 0) {
      const allTasks = await db
        .select({
          id: dailyTasksTable.id,
          goalId: dailyTasksTable.goalId,
          dayNumber: dailyTasksTable.dayNumber,
          taskDescription: dailyTasksTable.taskDescription,
          estimatedDuration: dailyTasksTable.estimatedDuration,
          isCompleted: dailyTasksTable.isCompleted,
          orderIndex: dailyTasksTable.orderIndex,
          proofRequired: dailyTasksTable.proofRequired,
          proofSubmittedAt: dailyTasksTable.proofSubmittedAt,
          taskType: dailyTasksTable.taskType,
          appLink: dailyTasksTable.appLink,
          category: dailyTasksTable.category,
        })
        .from(dailyTasksTable)
        .where(inArray(dailyTasksTable.goalId, activeGoalIds))
        .orderBy(asc(dailyTasksTable.dayNumber), asc(dailyTasksTable.orderIndex));

      for (const goal of activeGoals) {
        const goalTasks = allTasks.filter((t) => t.goalId === goal.id);
        const today = goalTasks
          .filter((t) => t.dayNumber === goal.currentDay)
          .map((t) => ({
            id: t.id,
            taskDescription: t.taskDescription,
            estimatedDuration: t.estimatedDuration ?? undefined,
            isCompleted: t.isCompleted,
            dayNumber: t.dayNumber,
            proofRequired: t.proofRequired ?? undefined,
            proofSubmittedAt: t.proofSubmittedAt
              ? (t.proofSubmittedAt as Date).toISOString?.()
              : undefined,
            taskType: t.taskType ?? undefined,
            appLink: t.appLink ?? undefined,
            category: t.category ?? undefined,
          }));
        const tomorrow = goalTasks
          .filter((t) => t.dayNumber === goal.currentDay + 1)
          .map((t) => ({
            id: t.id,
            taskDescription: t.taskDescription,
            estimatedDuration: t.estimatedDuration ?? undefined,
            isCompleted: t.isCompleted,
            dayNumber: t.dayNumber,
          }));

        // Completed day numbers: days where ALL tasks are completed
        const dayGroups = new Map<number, boolean[]>();
        for (const t of goalTasks) {
          if (!dayGroups.has(t.dayNumber)) dayGroups.set(t.dayNumber, []);
          dayGroups.get(t.dayNumber)!.push(t.isCompleted);
        }
        const completedDays = Array.from(dayGroups.entries())
          .filter(([, statuses]) => statuses.length > 0 && statuses.every(Boolean))
          .map(([day]) => day)
          .sort((a, b) => a - b);

        tasksByGoalId[goal.id] = { today, tomorrow, completedDays };
      }
    }

    const goalsPayload = goals.map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description ?? undefined,
      targetDate: (g.targetDate as Date)?.toISOString?.() ?? String(g.targetDate),
      totalDays: g.totalDays,
      dailyTimeCommitment: g.dailyTimeCommitment ?? undefined,
      currentDay: g.currentDay,
      status: g.status,
      streakCount: g.streakCount,
      longestStreak: g.longestStreak,
      createdAt: (g.createdAt as Date)?.toISOString?.() ?? String(g.createdAt),
      updatedAt: (g.updatedAt as Date)?.toISOString?.() ?? String(g.updatedAt),
    }));

    return NextResponse.json({
      goals: goalsPayload,
      tasksByGoalId,
    });
  } catch (err) {
    console.error("Goals dashboard error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load dashboard" },
      { status: 500 }
    );
  }
}
