export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { goalsTable, dailyTasksTable, type GoalStatus } from "@/db/schema/goals-schema";
import { eq, and, asc } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolvedParams = await params;
    const rawId = resolvedParams?.id;
    const goalId = typeof rawId === "string" ? rawId.trim() : String(rawId ?? "").trim();

    console.log("[GET /api/goals/[id]] Request", {
      rawId,
      goalId,
      goalIdLength: goalId.length,
      userId,
    });

    if (!goalId) return NextResponse.json({ error: "Goal ID required" }, { status: 400 });

    const [goal] = await db
      .select()
      .from(goalsTable)
      .where(and(eq(goalsTable.id, goalId), eq(goalsTable.userId, userId)));

    console.log("Goal query:", {
      goal: goal ? { id: goal.id, title: goal.title, userId: goal.userId } : null,
      error: goal ? null : "not found",
      id: goalId,
      userId,
    });

    if (!goal) {
      const byIdOnly = await db
        .select({ id: goalsTable.id, userId: goalsTable.userId })
        .from(goalsTable)
        .where(eq(goalsTable.id, goalId));
      console.error("[GET /api/goals/[id]] Goal not found", {
        goalId,
        userId,
        queryByIdOnly: byIdOnly.length > 0 ? { found: true, rowUserId: byIdOnly[0].userId } : { found: false },
      });
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    console.log("[GET /api/goals/[id]] Goal found", { goalId: goal.id, title: goal.title });

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

    const tasks = await db
      .select()
      .from(dailyTasksTable)
      .where(eq(dailyTasksTable.goalId, goalId))
      .orderBy(asc(dailyTasksTable.dayNumber), asc(dailyTasksTable.orderIndex));

    return NextResponse.json({
      goal: {
        id: goal.id,
        title: goal.title,
        description: goal.description ?? undefined,
        targetDate: (goal.targetDate as Date)?.toISOString?.() ?? String(goal.targetDate),
        totalDays: goal.totalDays,
        dailyTimeCommitment: goal.dailyTimeCommitment ?? undefined,
        currentDay: goal.currentDay,
        status: goal.status,
        streakCount: goal.streakCount,
        longestStreak: goal.longestStreak,
        hasSkipToken,
        startDate: startDate.toISOString().slice(0, 10),
        createdAt: (goal.createdAt as Date)?.toISOString?.() ?? String(goal.createdAt),
      },
      tasks: tasks.map((t) => ({
        id: t.id,
        goalId: t.goalId,
        dayNumber: t.dayNumber,
        taskDescription: t.taskDescription,
        estimatedDuration: t.estimatedDuration ?? undefined,
        howToComplete: t.howToComplete ?? undefined,
        isCompleted: t.isCompleted,
        orderIndex: t.orderIndex,
        taskType: t.taskType ?? "external",
        appLink: t.appLink ?? undefined,
        appLabel: t.appLabel ?? undefined,
        category: t.category ?? undefined,
        completedAt: t.completedAt
          ? (t.completedAt as Date)?.toISOString?.()
          : undefined,
        proofRequired: t.proofRequired ?? true,
        proofType: t.proofType ?? undefined,
        proofUrl: t.proofUrl ?? undefined,
        proofText: t.proofText ?? undefined,
        proofSubmittedAt: t.proofSubmittedAt
          ? (t.proofSubmittedAt as Date)?.toISOString?.()
          : undefined,
      })),
    });
  } catch (err) {
    console.error("Goal fetch error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch goal" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Goal ID required" }, { status: 400 });

    const [goal] = await db
      .select()
      .from(goalsTable)
      .where(and(eq(goalsTable.id, id), eq(goalsTable.userId, userId)));

    if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const { status, title, description } = body as {
      status?: string;
      title?: string;
      description?: string;
    };

    if (goal.status === "archived") {
      return NextResponse.json({ error: "Cannot update archived goal" }, { status: 400 });
    }

    const now = new Date();
    const updates: { status?: GoalStatus; title?: string; description?: string | null; updatedAt: Date } = {
      updatedAt: now,
    };

    if (goal.status === "completed") {
      if (typeof status !== "string" || status !== "archived") {
        return NextResponse.json({ error: "Completed goals can only be archived" }, { status: 400 });
      }
      updates.status = "archived";
    } else {
      const validActiveStatuses: GoalStatus[] = ["active", "paused"];
      if (typeof status === "string" && validActiveStatuses.includes(status as GoalStatus)) {
        updates.status = status as GoalStatus;
      }
      if (typeof title === "string" && title.trim()) {
        updates.title = title.trim();
      }
      if (Object.prototype.hasOwnProperty.call(body, "description")) {
        updates.description = typeof description === "string" ? description.trim() || null : null;
      }
    }

    const keysExceptUpdatedAt = Object.keys(updates).filter((k) => k !== "updatedAt");
    if (keysExceptUpdatedAt.length === 0) {
      return NextResponse.json({ error: "No valid updates provided" }, { status: 400 });
    }

    await db
      .update(goalsTable)
      .set(updates)
      .where(and(eq(goalsTable.id, id), eq(goalsTable.userId, userId)));

    return NextResponse.json({ ok: true, ...updates });
  } catch (err) {
    console.error("Goal PATCH error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update goal" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Goal ID required" }, { status: 400 });

    const [goal] = await db
      .select({ id: goalsTable.id })
      .from(goalsTable)
      .where(and(eq(goalsTable.id, id), eq(goalsTable.userId, userId)));

    if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 });

    await db.delete(dailyTasksTable).where(eq(dailyTasksTable.goalId, id));
    await db.delete(goalsTable).where(and(eq(goalsTable.id, id), eq(goalsTable.userId, userId)));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Goal delete error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete goal" },
      { status: 500 }
    );
  }
}
