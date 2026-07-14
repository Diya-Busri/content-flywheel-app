/**
 * POST /api/admin/motion-graphics/agent-runs/:runId/cancel
 *
 * Cancels an active or approval-waiting run.
 * Terminal runs (completed, failed, cancelled) are returned as-is.
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
import type { MgRunStatus } from "@/lib/motion-graphics/agent-types";

type Ctx = { params: Promise<{ runId: string }> };

const CANCELLABLE_STATUSES: MgRunStatus[] = [
  "queued",
  "analysing",
  "strategising",
  "awaiting_plan_approval",
  "scripting",
  "storyboarding",
  "awaiting_storyboard_approval",
];

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

  await transitionMgRunStatus(userId, runId, CANCELLABLE_STATUSES, "cancelled");

  const result = await getMgRunWithSteps(userId, runId);
  return NextResponse.json(result);
}
