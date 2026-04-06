import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { goalsTable, dailyTasksTable } from "@/db/schema/goals-schema";
import { eq, and, isNull } from "drizzle-orm";

/**
 * POST /api/goals/auto-complete
 * Body: { trigger: "product_created" | "video_created" }
 *
 * Finds any incomplete app_action tasks whose appLink matches the trigger's
 * path and auto-marks them as completed (no proof required for auto-complete).
 * Called client-side after product or video creation succeeds.
 */

const TRIGGER_PATHS: Record<string, string[]> = {
  product_created: [
    "/dashboard/digital-products",
    "/dashboard/digital-products/create",
    "/dashboard/products",
  ],
  video_created: [
    "/dashboard/digital-products/videos",
    "/dashboard/library",
    "/dashboard/video",
  ],
};

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const trigger = body.trigger as string | undefined;
    if (!trigger || !TRIGGER_PATHS[trigger]) {
      return NextResponse.json({ error: "Invalid trigger" }, { status: 400 });
    }

    const matchPaths = TRIGGER_PATHS[trigger];

    // Find active goals for this user
    const activeGoals = await db
      .select({ id: goalsTable.id })
      .from(goalsTable)
      .where(and(eq(goalsTable.userId, userId), eq(goalsTable.status, "active")));

    if (activeGoals.length === 0) {
      return NextResponse.json({ completed: 0 });
    }

    const goalIds = activeGoals.map((g) => g.id);

    // Find matching incomplete app_action tasks across all active goals
    const allTasks = await db
      .select({
        id: dailyTasksTable.id,
        goalId: dailyTasksTable.goalId,
        appLink: dailyTasksTable.appLink,
      })
      .from(dailyTasksTable)
      .where(
        and(
          eq(dailyTasksTable.taskType, "app_action"),
          eq(dailyTasksTable.isCompleted, false),
          isNull(dailyTasksTable.completedAt)
        )
      );

    // Filter to tasks belonging to active goals whose appLink matches
    const toComplete = allTasks.filter(
      (t) =>
        goalIds.includes(t.goalId) &&
        t.appLink &&
        matchPaths.some((p) => t.appLink!.startsWith(p))
    );

    if (toComplete.length === 0) {
      return NextResponse.json({ completed: 0 });
    }

    const now = new Date();
    await Promise.all(
      toComplete.map((task) =>
        db
          .update(dailyTasksTable)
          .set({
            isCompleted: true,
            completedAt: now,
            proofDescription: "Auto-completed by Content Flywheel activity",
            validationStatus: "validated",
          })
          .where(eq(dailyTasksTable.id, task.id))
      )
    );

    return NextResponse.json({ completed: toComplete.length });
  } catch (e) {
    console.error("[goals/auto-complete] error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
