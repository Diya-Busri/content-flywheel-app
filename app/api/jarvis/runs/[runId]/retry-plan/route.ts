/**
 * POST /api/jarvis/runs/[runId]/retry-plan — retries the planning phase for
 * a run whose planning previously failed. Reuses the same run row (goal,
 * id, and prior failed steps stay in the audit log) rather than creating a
 * new run.
 *
 * Idempotent via the same compare-and-swap as the initial planning call:
 * only a run currently in "failed" status with no plan yet can be retried;
 * concurrent retry clicks collapse into a single execution.
 */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { getRunForUser, getStepsForRun } from "@/lib/jarvis/run-store";
import { runPlanningPhase } from "@/lib/jarvis/orchestrator";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const [userId, unauthorized] = await requireAuth();
    if (unauthorized) return unauthorized;

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const { runId } = await params;
    const run = await getRunForUser(userId, runId);
    if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

    if (run.status !== "failed" || run.plan) {
      // Nothing to retry — either it's not in a failed state, or it failed
      // after planning already succeeded (that's a generate/save retry, not
      // a plan retry).
      const steps = await getStepsForRun(userId, runId);
      return NextResponse.json({ run, steps });
    }

    const result = await runPlanningPhase(userId, runId);
    if (result.status === "not_found") {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const steps = await getStepsForRun(userId, result.run.id);
    return NextResponse.json({ run: result.run, steps });
  } catch (err) {
    console.error("[jarvis/runs/:id/retry-plan POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
