import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, client } from "@/db/db";
import { goalsTable } from "@/db/schema/goals-schema";
import { TASK_CATEGORIES } from "@/lib/goals/categories";
import { generateTasks } from "@/lib/goals/generate-tasks";
import { eq, desc } from "drizzle-orm";

const TASK_INSERT_COLUMNS = [
  "goal_id",
  "day_number",
  "task_description",
  "estimated_duration",
  "how_to_complete",
  "order_index",
  "task_type",
  "app_link",
  "app_label",
  "category",
] as const;

function durationStringToMinutes(s: string): number {
  const m = s.match(/^(\d+)\s*min$/i);
  if (m) return parseInt(m[1], 10) || 30;
  const h = s.match(/^(\d+)\s*hr/i);
  if (h) return (parseInt(h[1], 10) || 1) * 60;
  return 30;
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const goals = await db
      .select()
      .from(goalsTable)
      .where(eq(goalsTable.userId, userId))
      .orderBy(desc(goalsTable.createdAt));

    const items = goals.map((g) => ({
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
    }));

    return NextResponse.json(items);
  } catch (err) {
    console.error("Goals list error:", err);
    return NextResponse.json({ error: "Failed to fetch goals" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { title, description, totalDays, dailyTimeCommitment, tasks } = body as {
      title?: string;
      description?: string;
      totalDays?: number;
      dailyTimeCommitment?: number;
      tasks?: Array<{
        dayNumber: number;
        taskDescription: string;
        estimatedDuration?: number;
        howToComplete?: string;
        orderIndex?: number;
        taskType?: "external" | "app_action";
        appLink?: string;
        appLabel?: string;
        category?: string;
      }>;
    };

    if (!title || typeof title !== "string" || title.trim() === "") {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    if (!totalDays || typeof totalDays !== "number" || totalDays < 1) {
      return NextResponse.json({ error: "totalDays is required and must be positive" }, { status: 400 });
    }
    const now = new Date();
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + totalDays);

    const [goal] = await db
      .insert(goalsTable)
      .values({
        userId,
        title: title.trim(),
        description: description?.trim() || null,
        targetDate,
        totalDays,
        dailyTimeCommitment:
          typeof dailyTimeCommitment === "number" && dailyTimeCommitment > 0
            ? dailyTimeCommitment
            : null,
        currentDay: 1,
        status: "active",
        streakCount: 0,
        longestStreak: 0,
      })
      .returning({ id: goalsTable.id });

    if (!goal?.id) {
      return NextResponse.json({ error: "Failed to create goal" }, { status: 500 });
    }

    const baseTaskRow = (
      dayNum: number,
      desc: string,
      estDur: number | null,
      howTo: string | null,
      idx: number,
      ttype: "external" | "app_action",
      appL: string | null,
      appLab: string | null,
      cat: string | null
    ) => ({
      goalId: goal.id,
      dayNumber: dayNum,
      taskDescription: desc,
      estimatedDuration: estDur,
      howToComplete: howTo,
      orderIndex: idx,
      taskType: ttype,
      appLink: appL,
      appLabel: appLab,
      category: cat,
    });

    let taskRows: ReturnType<typeof baseTaskRow>[];

    if (Array.isArray(tasks) && tasks.length > 0) {
      taskRows = tasks.map((t, i) =>
        baseTaskRow(
          Math.max(1, Math.min(totalDays, Math.floor(t.dayNumber))),
          String(t.taskDescription).trim().slice(0, 500),
          typeof t.estimatedDuration === "number" && t.estimatedDuration > 0 ? t.estimatedDuration : null,
          typeof t.howToComplete === "string" ? t.howToComplete.trim().slice(0, 2000) : null,
          typeof t.orderIndex === "number" ? Math.max(0, t.orderIndex) : i,
          t.taskType === "app_action" ? "app_action" : "external",
          typeof t.appLink === "string" && t.appLink ? t.appLink.trim().slice(0, 500) : null,
          typeof t.appLabel === "string" && t.appLabel ? t.appLabel.trim().slice(0, 100) : null,
          typeof t.category === "string" && (TASK_CATEGORIES as readonly string[]).includes(t.category.trim())
            ? t.category.trim()
            : null
        )
      );
    } else {
      const mins = typeof dailyTimeCommitment === "number" && dailyTimeCommitment > 0
        ? dailyTimeCommitment
        : 60;
      const dailyTimeStr =
        mins <= 30 ? "30min"
        : mins <= 60 ? "1hr"
        : mins <= 120 ? "2hr"
        : mins <= 180 ? "3hr"
        : "4hr+";
      const generated = await generateTasks({
        title: title.trim(),
        description: description?.trim(),
        totalDays,
        dailyTimeCommitment: dailyTimeStr,
        daysToGenerate: [1],
      });
      taskRows = generated.map((t, i) =>
        baseTaskRow(
          Math.max(1, Math.min(totalDays, t.dayNumber)),
          t.taskDescription.slice(0, 500),
          durationStringToMinutes(t.duration),
          t.howToComplete ? t.howToComplete.slice(0, 2000) : null,
          i,
          t.taskType === "app_action" ? "app_action" : "external",
          t.appLink ?? null,
          t.appLabel ?? null,
          t.category && (TASK_CATEGORIES as readonly string[]).includes(t.category) ? t.category : null
        )
      );
    }

    if (taskRows.length > 0) {
      // Insert only task-creation columns; proof/validation columns are set when user submits proof
      const rowsForDb = taskRows.map((r) => ({
        goal_id: r.goalId,
        day_number: r.dayNumber,
        task_description: r.taskDescription,
        estimated_duration: r.estimatedDuration,
        how_to_complete: r.howToComplete,
        order_index: r.orderIndex,
        task_type: r.taskType,
        app_link: r.appLink,
        app_label: r.appLabel,
        category: r.category,
      }));
      await client`
        INSERT INTO daily_tasks ${client(rowsForDb, ...TASK_INSERT_COLUMNS)}
      `;
    }

    return NextResponse.json({ id: String(goal.id) });
  } catch (err) {
    console.error("Goals create error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create goal" },
      { status: 500 }
    );
  }
}
