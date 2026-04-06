import { db } from "@/db/db";
import { goalsTable, dailyTasksTable } from "@/db/schema/goals-schema";
import { eq, and, isNull } from "drizzle-orm";

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

/**
 * Auto-complete any app_action goal tasks whose appLink matches the trigger.
 * Non-fatal: errors are swallowed so they never break the calling flow.
 */
export async function autoCompleteGoalTasks(
  userId: string,
  trigger: "product_created" | "video_created"
): Promise<void> {
  try {
    const matchPaths = TRIGGER_PATHS[trigger];
    if (!matchPaths) return;

    const activeGoals = await db
      .select({ id: goalsTable.id })
      .from(goalsTable)
      .where(and(eq(goalsTable.userId, userId), eq(goalsTable.status, "active")));

    if (activeGoals.length === 0) return;

    const goalIds = activeGoals.map((g) => g.id);

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

    const toComplete = allTasks.filter(
      (t) =>
        goalIds.includes(t.goalId) &&
        t.appLink &&
        matchPaths.some((p) => t.appLink!.startsWith(p))
    );

    if (toComplete.length === 0) return;

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
  } catch {
    // Non-fatal: never block the main flow
  }
}
