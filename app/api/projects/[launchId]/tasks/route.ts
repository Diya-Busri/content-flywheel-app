/**
 * PATCH /api/projects/[launchId]/tasks
 * Mark an AI task as done or skipped.
 * Body: { taskId: string; status: 'done' | 'skipped' }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import type { LaunchStageResults } from "@/db/schema/launch-schema";
import { eq, and } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ launchId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { launchId } = await params;
  const { taskId, status } = await req.json() as { taskId: string; status: "done" | "skipped" };

  if (!taskId || !["done", "skipped"].includes(status)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const [project] = await db
    .select()
    .from(launchProjectsTable)
    .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)))
    .limit(1);

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const results = project.stageResults ?? ({} as LaunchStageResults);
  const growth  = results.growth ?? {};
  const tasks   = (growth.aiTasks ?? []).map(t =>
    t.id === taskId ? { ...t, status } : t
  );

  const updated = { ...results, growth: { ...growth, aiTasks: tasks } };

  await db
    .update(launchProjectsTable)
    .set({ stageResults: updated, updatedAt: new Date() })
    .where(eq(launchProjectsTable.id, launchId));

  return NextResponse.json({ success: true });
}
