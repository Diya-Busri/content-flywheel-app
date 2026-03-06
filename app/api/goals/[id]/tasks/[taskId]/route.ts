import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { goalsTable, dailyTasksTable } from "@/db/schema/goals-schema";
import { eq, and } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: goalId, taskId } = await params;
    if (!goalId || !taskId) {
      return NextResponse.json({ error: "Goal ID and task ID required" }, { status: 400 });
    }

    const [goal] = await db
      .select()
      .from(goalsTable)
      .where(and(eq(goalsTable.id, goalId), eq(goalsTable.userId, userId)));
    if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const {
      isCompleted,
      proofType,
      proofUrl,
      proofText,
      proofValidationStatus,
    } = body as {
      isCompleted?: boolean;
      proofType?: "screenshot" | "text" | "link" | "file";
      proofUrl?: string | null;
      proofText?: string | null;
      proofValidationStatus?: "validated" | "validation_skipped" | null;
    };

    const [existing] = await db
      .select({
        proofRequired: dailyTasksTable.proofRequired,
        proofSubmittedAt: dailyTasksTable.proofSubmittedAt,
        taskType: dailyTasksTable.taskType,
      })
      .from(dailyTasksTable)
      .where(
        and(
          eq(dailyTasksTable.id, taskId),
          eq(dailyTasksTable.goalId, goalId)
        )
      );
    if (!existing) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const updates: Record<string, unknown> = {};
    const hasProofPayload =
      proofType && (proofUrl != null || proofText != null);
    if (hasProofPayload) {
      if (
        proofType === "screenshot" ||
        proofType === "text" ||
        proofType === "link" ||
        proofType === "file"
      ) {
        if (existing.taskType === "app_action" && proofType === "text") {
          return NextResponse.json(
            { error: "App tasks require a screenshot or link as proof." },
            { status: 400 }
          );
        }
        updates.proofType = proofType;
        updates.proofUrl = proofUrl ?? null;
        updates.proofText = proofText ?? null;
        updates.proofSubmittedAt = new Date();
        if (
          proofValidationStatus === "validated" ||
          proofValidationStatus === "validation_skipped"
        ) {
          updates.proofValidationStatus = proofValidationStatus;
        }
      }
    }
    if (typeof isCompleted === "boolean") {
      const canComplete =
        !isCompleted ||
        !existing.proofRequired ||
        existing.proofSubmittedAt != null ||
        hasProofPayload;
      if (canComplete) {
        updates.isCompleted = isCompleted;
        updates.completedAt = isCompleted ? new Date() : null;
      }
    }

    const [updated] = await db
      .update(dailyTasksTable)
      .set(updates)
      .where(
        and(
          eq(dailyTasksTable.id, taskId),
          eq(dailyTasksTable.goalId, goalId)
        )
      )
      .returning();

    if (!updated) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("Task update error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update task" },
      { status: 500 }
    );
  }
}
