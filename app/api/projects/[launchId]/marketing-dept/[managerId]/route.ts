/**
 * PATCH /api/projects/[launchId]/marketing-dept/[managerId]
 * ──────────────────────────────────────────────────────────────────────────────
 * Manage a marketing manager's state.
 *
 * Actions:
 *   { action: "pause" }          — pause this manager
 *   { action: "resume" }         — resume this manager
 *   { action: "add_task", instruction: string } — add MC task to queue
 *   { action: "clear_outputs" }  — clear all outputs
 *   { action: "clear_history" }  — clear history
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import type {
  LaunchStageResults,
  MarketingManagerId,
  MarketingManager,
  ManagerTask,
} from "@/db/schema/launch-schema";
import { eq, and } from "drizzle-orm";

const VALID_IDS = new Set<MarketingManagerId>([
  "tiktok", "instagram", "youtube", "x", "linkedin", "email", "seo",
]);

function uid() { return Math.random().toString(36).slice(2, 10); }

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ launchId: string; managerId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { launchId, managerId } = await params;

  if (!VALID_IDS.has(managerId as MarketingManagerId)) {
    return NextResponse.json({ error: "Invalid manager ID" }, { status: 400 });
  }
  const mid = managerId as MarketingManagerId;

  const body = await req.json().catch(() => ({})) as {
    action: "pause" | "resume" | "add_task" | "clear_outputs" | "clear_history";
    instruction?: string;
    label?: string;
  };

  const [project] = await db
    .select()
    .from(launchProjectsTable)
    .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)))
    .limit(1);

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const results = project.stageResults ?? ({} as LaunchStageResults);
  const dept    = results.marketingDept ?? { managers: {} };
  const manager = dept.managers[mid] ?? { id: mid, status: "idle", queue: [], history: [], outputs: [], suggestions: [], runCount: 0 };

  let updated: MarketingManager;

  switch (body.action) {
    case "pause":
      updated = { ...manager, status: "paused" };
      break;

    case "resume":
      updated = { ...manager, status: "idle" };
      break;

    case "add_task": {
      const task: ManagerTask = {
        id:          uid(),
        label:       body.label ?? "Mission Control task",
        instruction: body.instruction,
        status:      "pending",
        createdAt:   new Date().toISOString(),
      };
      updated = { ...manager, queue: [...(manager.queue ?? []), task] };
      break;
    }

    case "clear_outputs":
      updated = { ...manager, outputs: [] };
      break;

    case "clear_history":
      updated = { ...manager, history: [] };
      break;

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const newDept = {
    ...dept,
    managers:    { ...dept.managers, [mid]: updated },
    lastUpdated: new Date().toISOString(),
  };

  await db
    .update(launchProjectsTable)
    .set({ stageResults: { ...results, marketingDept: newDept }, updatedAt: new Date() })
    .where(eq(launchProjectsTable.id, launchId));

  return NextResponse.json({ manager: updated });
}
