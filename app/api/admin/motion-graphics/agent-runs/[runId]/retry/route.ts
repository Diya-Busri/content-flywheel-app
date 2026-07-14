/**
 * POST /api/admin/motion-graphics/agent-runs/:runId/retry
 *
 * Retries a failed run.
 *
 * Retry safety rules (Correction 8):
 * - If a step completed and its output was saved (e.g. plan was stored on the run),
 *   the phase is not re-executed — instead the run is re-routed to the appropriate
 *   gate so the user can continue from where they left off.
 * - If a step failed before producing usable output, the run is reset to the
 *   preceding gate so the user can re-trigger generation.
 * - Credits already deducted for completed steps are NOT refunded.
 * - A new attempt_number is created for failed steps when re-run.
 *
 * First-delivery scope: only failed runs can be retried.
 * The retry logic routes based on what data is already persisted on the run.
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/motion-graphics/guard";
import { currentUser } from "@clerk/nextjs/server";
import {
  getMgRunForUser,
  transitionMgRunStatus,
  getMgRunWithSteps,
} from "@/lib/motion-graphics/mg-run-store";

type Ctx = { params: Promise<{ runId: string }> };

export async function POST(_req: NextRequest, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const user = await currentUser();
  const userId = user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { runId } = await params;

  const run = await getMgRunForUser(userId, runId);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  if (run.status !== "failed") {
    return NextResponse.json(
      { error: "Only failed runs can be retried" },
      { status: 422 }
    );
  }

  // Route based on persisted data:
  // - If plan exists → failed during phase 2 (script/storyboard). Reset to awaiting_plan_approval.
  // - If no plan → failed during phase 1. Reset to queued so the user re-submits.
  if (run.plan) {
    // Plan was saved — retry generation from plan approval
    await transitionMgRunStatus(
      userId, runId,
      ["failed"], "awaiting_plan_approval",
      { currentGate: "plan_review", error: null }
    );
  } else {
    // No plan — failed in phase 1. Reset to queued for re-analysis.
    // (Client will need to POST /agent-runs again to restart from scratch)
    await transitionMgRunStatus(
      userId, runId,
      ["failed"], "queued",
      { currentGate: null, error: null }
    );
  }

  const result = await getMgRunWithSteps(userId, runId);
  return NextResponse.json(result);
}
