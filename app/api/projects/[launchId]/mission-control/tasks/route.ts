/**
 * PATCH /api/projects/[launchId]/mission-control/tasks
 *
 * Updates the status of a single task in the current Mission Control plan.
 * Used by the UI to mark tasks as running/done/skipped during execution.
 *
 * Body: { taskId: string, status: "pending"|"running"|"done"|"skipped" }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import type { MissionTask } from "@/db/schema/launch-schema";
import { eq, and } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ launchId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { launchId } = await params;
  const { taskId, status } = await req.json() as {
    taskId: string;
    status: MissionTask["status"];
  };

  if (!taskId || !status) {
    return NextResponse.json({ error: "taskId and status required" }, { status: 400 });
  }

  const [project] = await db
    .select()
    .from(launchProjectsTable)
    .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)))
    .limit(1);

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const results = project.stageResults;
  if (!results?.missionControl?.currentPlan) {
    return NextResponse.json({ error: "No active plan" }, { status: 404 });
  }

  const now  = new Date().toISOString();
  const plan = results.missionControl.currentPlan;

  const updatedTasks = plan.tasks.map(t => {
    if (t.id !== taskId) return t;
    return {
      ...t,
      status,
      completedAt: status === "done" || status === "skipped" ? now : t.completedAt,
    };
  });

  const updatedResults = {
    ...results,
    missionControl: {
      ...results.missionControl,
      currentPlan: { ...plan, tasks: updatedTasks },
    },
  };

  await db
    .update(launchProjectsTable)
    .set({ stageResults: updatedResults, updatedAt: new Date() })
    .where(eq(launchProjectsTable.id, launchId));

  return NextResponse.json({ task: updatedTasks.find(t => t.id === taskId) });
}
