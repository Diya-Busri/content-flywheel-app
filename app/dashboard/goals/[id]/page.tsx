/**
 * Goal detail - Today's tasks, proof upload, complete day
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { goalsTable, dailyTasksTable } from "@/db/schema/goals-schema";
import { eq, and, asc } from "drizzle-orm";
import GoalDetailFlow from "./GoalDetailFlow";

export const metadata: Metadata = {
  title: "Goal | Content Flywheel",
  description: "Continue your goal",
};

export default async function GoalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolved = await params;
  const goalId = resolved?.id?.trim();

  if (!goalId) {
    return (
      <main className="p-6 md:p-10 max-w-2xl mx-auto">
        <div className="text-slate-600 dark:text-slate-400">Invalid goal ID</div>
      </main>
    );
  }

  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  console.log("Fetching goal:", { goalId, userId });

  const [goal] = await db
    .select()
    .from(goalsTable)
    .where(and(eq(goalsTable.id, goalId), eq(goalsTable.userId, userId)));

  console.log("Goal query result:", {
    found: !!goal,
    goalId,
    userId,
  });

  if (!goal) {
    return (
      <main className="p-6 md:p-10 max-w-2xl mx-auto">
        <div className="text-slate-600 dark:text-slate-400">
          Goal not found. Check terminal for details.
        </div>
      </main>
    );
  }

  const now = new Date();
  const lastSkipped = goal.lastSkippedAt ? new Date(goal.lastSkippedAt as Date) : null;
  const day = now.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  const thisWeekStart = new Date(now);
  thisWeekStart.setUTCDate(now.getUTCDate() - diff);
  thisWeekStart.setUTCHours(0, 0, 0, 0);
  const hasSkipToken = !lastSkipped || lastSkipped < thisWeekStart;

  const targetDate = new Date((goal.targetDate as Date).getTime());
  const startDate = new Date(targetDate);
  startDate.setDate(targetDate.getDate() - (goal.totalDays - 1));
  startDate.setUTCHours(0, 0, 0, 0);

  const initialGoal = {
    id: goal.id,
    title: goal.title,
    targetDate: (goal.targetDate as Date)?.toISOString?.() ?? String(goal.targetDate),
    totalDays: goal.totalDays,
    currentDay: goal.currentDay,
    streakCount: goal.streakCount,
    longestStreak: goal.longestStreak,
    status: goal.status,
    hasSkipToken,
    startDate: startDate.toISOString().slice(0, 10),
  };

  const tasks = await db
    .select({
      id: dailyTasksTable.id,
      goalId: dailyTasksTable.goalId,
      dayNumber: dailyTasksTable.dayNumber,
      taskDescription: dailyTasksTable.taskDescription,
      estimatedDuration: dailyTasksTable.estimatedDuration,
      howToComplete: dailyTasksTable.howToComplete,
      isCompleted: dailyTasksTable.isCompleted,
      orderIndex: dailyTasksTable.orderIndex,
      taskType: dailyTasksTable.taskType,
      appLink: dailyTasksTable.appLink,
      appLabel: dailyTasksTable.appLabel,
      category: dailyTasksTable.category,
      proofRequired: dailyTasksTable.proofRequired,
      proofType: dailyTasksTable.proofType,
      proofUrl: dailyTasksTable.proofUrl,
      proofText: dailyTasksTable.proofText,
      proofSubmittedAt: dailyTasksTable.proofSubmittedAt,
      completedAt: dailyTasksTable.completedAt,
    })
    .from(dailyTasksTable)
    .where(eq(dailyTasksTable.goalId, goalId))
    .orderBy(asc(dailyTasksTable.dayNumber), asc(dailyTasksTable.orderIndex));

  const initialTasks = tasks.map((t) => ({
    id: t.id,
    goalId: t.goalId,
    dayNumber: t.dayNumber,
    taskDescription: t.taskDescription,
    estimatedDuration: t.estimatedDuration ?? undefined,
    howToComplete: t.howToComplete ?? undefined,
    isCompleted: t.isCompleted,
    orderIndex: t.orderIndex,
    taskType: t.taskType ?? ("external" as const),
    appLink: t.appLink ?? undefined,
    appLabel: t.appLabel ?? undefined,
    category: t.category ?? undefined,
    proofRequired: t.proofRequired ?? true,
    proofType: t.proofType ?? undefined,
    proofUrl: t.proofUrl ?? undefined,
    proofText: t.proofText ?? undefined,
    proofSubmittedAt: t.proofSubmittedAt
      ? (t.proofSubmittedAt as Date)?.toISOString?.()
      : undefined,
    completedAt: t.completedAt ? (t.completedAt as Date)?.toISOString?.() : undefined,
  }));

  return (
    <GoalDetailFlow
      goalId={goalId}
      initialGoal={initialGoal}
      initialTasks={initialTasks}
    />
  );
}
