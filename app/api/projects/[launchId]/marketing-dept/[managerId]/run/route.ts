/**
 * POST /api/projects/[launchId]/marketing-dept/[managerId]/run
 * ──────────────────────────────────────────────────────────────────────────────
 * Runs a specific marketing manager.
 * Body: { instruction?: string }  — optional focus from Mission Control
 *
 * Flow:
 *   1. Set manager status = "running", save to DB
 *   2. Call runMarketingManager()
 *   3. Append outputs, update history, set status = "idle"
 *   4. Extract memory facts, merge, save
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import type {
  LaunchStageResults,
  MarketingManagerId,
  MarketingManager,
  MarketingDepartment,
  ManagerTask,
} from "@/db/schema/launch-schema";
import { eq, and } from "drizzle-orm";
import { runMarketingManager, MANAGER_CONFIGS } from "@/lib/marketing-managers";
import { extractMemoryFacts, mergeMemoryFacts } from "@/lib/memory-context";

export const maxDuration = 120;

const VALID_IDS = new Set<MarketingManagerId>([
  "tiktok", "instagram", "youtube", "x", "linkedin", "email", "seo",
]);

function uid() { return Math.random().toString(36).slice(2, 10); }

function defaultManager(id: MarketingManagerId): MarketingManager {
  return { id, status: "idle", queue: [], history: [], outputs: [], suggestions: [], runCount: 0 };
}

export async function POST(
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

  const body = await req.json().catch(() => ({})) as { instruction?: string };

  /* Load project */
  const [project] = await db
    .select()
    .from(launchProjectsTable)
    .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)))
    .limit(1);

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const results = project.stageResults ?? ({} as LaunchStageResults);
  const dept    = results.marketingDept ?? { managers: {} };
  const manager = dept.managers[mid] ?? defaultManager(mid);

  /* Guard against concurrent runs */
  if (manager.status === "running") {
    return NextResponse.json({ error: "Manager is already running" }, { status: 409 });
  }

  /* Mark as running immediately */
  const config  = MANAGER_CONFIGS[mid];
  const runningManager: MarketingManager = {
    ...manager,
    status:      "running",
    currentTask: config.steps[0],
  };
  const runningDept: MarketingDepartment = {
    ...dept,
    managers: { ...dept.managers, [mid]: runningManager },
    lastUpdated: new Date().toISOString(),
  };

  await db
    .update(launchProjectsTable)
    .set({ stageResults: { ...results, marketingDept: runningDept }, updatedAt: new Date() })
    .where(eq(launchProjectsTable.id, launchId));

  /* Run the manager */
  const now = new Date().toISOString();
  let taskResult: Awaited<ReturnType<typeof runMarketingManager>>;

  try {
    taskResult = await runMarketingManager(mid, results, body.instruction);
  } catch (err) {
    /* On error: set status = "error" */
    const errManager: MarketingManager = {
      ...runningManager,
      status:      "error",
      currentTask: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
    await db
      .update(launchProjectsTable)
      .set({
        stageResults: {
          ...results,
          marketingDept: { ...runningDept, managers: { ...runningDept.managers, [mid]: errManager } },
        },
        updatedAt: new Date(),
      })
      .where(eq(launchProjectsTable.id, launchId));
    return NextResponse.json({ error: "Manager run failed", detail: String(err) }, { status: 500 });
  }

  /* Build completed manager state */
  const historyTask: ManagerTask = {
    id:          uid(),
    label:       `${config.label} run — ${taskResult.summary}`,
    instruction: body.instruction,
    status:      "done",
    createdAt:   now,
    completedAt: new Date().toISOString(),
    result:      taskResult.summary,
    outputCount: taskResult.outputs.length,
  };

  /* Keep last 20 history items; cap outputs at 100 */
  const updatedHistory  = [historyTask, ...(manager.history ?? [])].slice(0, 20);
  const updatedOutputs  = [...(manager.outputs ?? []), ...taskResult.outputs].slice(-100);
  const updatedSuggestions = taskResult.suggestions; // replace suggestions each run

  const completedManager: MarketingManager = {
    ...runningManager,
    status:      "idle",
    currentTask: undefined,
    outputs:     updatedOutputs,
    history:     updatedHistory,
    suggestions: updatedSuggestions,
    lastRunAt:   new Date().toISOString(),
    runCount:    (manager.runCount ?? 0) + 1,
  };

  /* Extract and merge memory facts */
  const freshResults = { ...results, marketingDept: { ...dept, managers: { ...dept.managers, [mid]: completedManager } } };
  const extracted   = extractMemoryFacts(freshResults, project.goal);
  const extraMF     = taskResult.memoryFacts ?? [];
  const existingMem = results.memory ?? { facts: [] };
  const merged      = mergeMemoryFacts(existingMem.facts, [...extracted, ...extraMF]);
  const updatedMem  = { ...existingMem, facts: merged, lastExtractedAt: new Date().toISOString() };

  const finalDept: MarketingDepartment = {
    managers: { ...dept.managers, [mid]: completedManager },
    lastUpdated: new Date().toISOString(),
  };

  await db
    .update(launchProjectsTable)
    .set({
      stageResults: { ...results, marketingDept: finalDept, memory: updatedMem },
      updatedAt:    new Date(),
    })
    .where(eq(launchProjectsTable.id, launchId));

  return NextResponse.json({ manager: completedManager, summary: taskResult.summary });
}
