import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { goalsTable, dailyTasksTable } from "@/db/schema/goals-schema";
import { eq, and, gte } from "drizzle-orm";
import { generateTasks } from "@/lib/goals/generate-tasks";

/**
 * POST /api/goals/[id]/regenerate-tasks
 * Deletes incomplete future tasks and regenerates them with AI.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const { id: goalId } = await params;

    const [goal] = await db
      .select()
      .from(goalsTable)
      .where(and(eq(goalsTable.id, goalId), eq(goalsTable.userId, userId)))
      .limit(1);

    if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    if (goal.status === "completed") {
      return NextResponse.json({ error: "Cannot regenerate tasks for a completed goal" }, { status: 400 });
    }

    const fromDay = goal.currentDay ?? 1;

    // Delete incomplete future tasks (currentDay onwards)
    await db
      .delete(dailyTasksTable)
      .where(
        and(
          eq(dailyTasksTable.goalId, goalId),
          gte(dailyTasksTable.dayNumber, fromDay),
          eq(dailyTasksTable.isCompleted, false)
        )
      );

    // Remaining days to generate
    const daysToGenerate: number[] = [];
    for (let d = fromDay; d <= goal.totalDays; d++) {
      daysToGenerate.push(d);
    }

    if (daysToGenerate.length === 0) {
      return NextResponse.json({ message: "No remaining days to generate", inserted: 0 });
    }

    const tasks = await generateTasks({
      title: goal.title,
      description: goal.description ?? undefined,
      totalDays: goal.totalDays,
      dailyTimeCommitment: goal.dailyTimeCommitment
        ? goal.dailyTimeCommitment <= 30 ? "30min"
          : goal.dailyTimeCommitment <= 60 ? "1hr"
          : goal.dailyTimeCommitment <= 120 ? "2hr"
          : "3hr"
        : "1hr",
      daysToGenerate,
    });

    if (!tasks.length) {
      return NextResponse.json({ error: "AI failed to generate tasks" }, { status: 500 });
    }

    // Parse duration string (e.g. "30min", "1hr") to minutes
    const parseDuration = (d: string): number | null => {
      if (!d) return null;
      const min = d.match(/(\d+)\s*min/i);
      if (min) return parseInt(min[1], 10);
      const hr = d.match(/(\d+)\s*hr/i);
      if (hr) return parseInt(hr[1], 10) * 60;
      return null;
    };

    const insertValues = tasks.map((t, i) => ({
      goalId,
      dayNumber: t.dayNumber,
      taskDescription: t.taskDescription,
      estimatedDuration: parseDuration(t.duration),
      howToComplete: t.howToComplete as string | null,
      orderIndex: i,
      taskType: (t.taskType ?? "external") as "external" | "app_action",
      appLink: (t.appLink ?? null) as string | null,
      appLabel: (t.appLabel ?? null) as string | null,
      category: (t.category ?? null) as string | null,
      proofRequired: true,
      proofDescription: "",
    }));

    for (const v of insertValues) {
      await db.insert(dailyTasksTable).values(v);
    }

    return NextResponse.json({ inserted: tasks.length });
  } catch (e) {
    console.error("[goals/regenerate-tasks] error:", e);
    return NextResponse.json({ error: "Failed to regenerate tasks" }, { status: 500 });
  }
}
