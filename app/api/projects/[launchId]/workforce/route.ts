/**
 * GET  /api/projects/[launchId]/workforce  — return all 6 worker states
 * PATCH /api/projects/[launchId]/workforce  — toggle pause/resume for a worker
 *
 * Workers states are initialised on first GET if they don't exist yet.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import type {
  LaunchStageResults,
  WorkerId,
  WorkerState,
  WorkforceData,
} from "@/db/schema/launch-schema";
import { eq, and } from "drizzle-orm";

/* ─── Default worker state factory ──────────────────────────────────────────── */

const WORKER_NEXT_TASKS: Record<WorkerId, string> = {
  research:  "Find new keyword opportunities",
  product:   "Review product for improvements",
  design:    "Brief new social graphic concepts",
  marketing: "Generate new TikTok hooks",
  store:     "Improve SEO metadata",
  growth:    "Run weekly growth check",
};

function defaultWorker(id: WorkerId, results: LaunchStageResults): WorkerState {
  return {
    isPaused:  false,
    isRunning: false,
    nextTask:  deriveNextTask(id, results),
    history:   [],
  };
}

export function deriveNextTask(id: WorkerId, results: LaunchStageResults): string {
  const m = results.marketing;
  switch (id) {
    case "research": {
      const kw = results.research?.keywords?.length ?? 0;
      return kw < 5 ? "Find keyword opportunities" : "Monitor competitor gaps";
    }
    case "product":
      return results.product?.productId ? "Review product for improvements" : "Waiting for product";
    case "design": {
      const a = results.design?.assetsCount ?? 0;
      return a < 2 ? "Generate cover & mockup concepts" : "Brief new social graphic";
    }
    case "marketing": {
      if (!m) return "Generate launch copy";
      const counts = [
        { label: "Generate TikTok hooks",   count: m.tiktokHooks?.length     ?? 0 },
        { label: "Create email sequence",   count: m.emails?.length           ?? 0 },
        { label: "Generate carousels",      count: m.carousels?.length        ?? 0 },
        { label: "Write X posts",           count: m.xPosts?.length           ?? 0 },
        { label: "Write Instagram captions",count: m.instagramCaptions?.length ?? 0 },
      ];
      return counts.sort((a, b) => a.count - b.count)[0].label;
    }
    case "store":
      return results.store?.storeUrl ? "Refresh SEO metadata" : "Improve product page CTAs";
    case "growth":
      return results.growth?.lastCheckedAt ? "Run weekly growth check" : "Run first growth check";
    default:
      return WORKER_NEXT_TASKS[id];
  }
}

function buildInitialWorkforce(results: LaunchStageResults): WorkforceData {
  const ids: WorkerId[] = ["research", "product", "design", "marketing", "store", "growth"];
  return {
    workers: Object.fromEntries(
      ids.map(id => [id, defaultWorker(id, results)])
    ) as WorkforceData["workers"],
  };
}

/* ─── GET handler ────────────────────────────────────────────────────────────── */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ launchId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { launchId } = await params;

  const [project] = await db
    .select()
    .from(launchProjectsTable)
    .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)))
    .limit(1);

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const results  = project.stageResults ?? ({} as LaunchStageResults);
  let workforce  = results.workforce;

  /* Initialise on first visit */
  if (!workforce) {
    workforce = buildInitialWorkforce(results);
    await db
      .update(launchProjectsTable)
      .set({ stageResults: { ...results, workforce }, updatedAt: new Date() })
      .where(eq(launchProjectsTable.id, launchId));
  }

  /* Always re-derive nextTask from fresh results (not stale stored value) */
  const ids: WorkerId[] = ["research", "product", "design", "marketing", "store", "growth"];
  for (const id of ids) {
    const w = workforce.workers[id];
    if (w && !w.isRunning) {
      w.nextTask = deriveNextTask(id, results);
    }
  }

  return NextResponse.json({ workforce });
}

/* ─── PATCH handler ──────────────────────────────────────────────────────────── */

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ launchId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { launchId } = await params;
  const { workerId, isPaused } = await req.json() as { workerId: WorkerId; isPaused: boolean };

  const [project] = await db
    .select()
    .from(launchProjectsTable)
    .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)))
    .limit(1);

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const results   = project.stageResults ?? ({} as LaunchStageResults);
  const workforce = results.workforce ?? buildInitialWorkforce(results);
  const worker    = workforce.workers[workerId] ?? defaultWorker(workerId, results);

  worker.isPaused = isPaused;
  workforce.workers[workerId] = worker;

  await db
    .update(launchProjectsTable)
    .set({ stageResults: { ...results, workforce }, updatedAt: new Date() })
    .where(eq(launchProjectsTable.id, launchId));

  return NextResponse.json({ worker });
}
