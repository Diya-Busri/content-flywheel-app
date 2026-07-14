/**
 * GET /api/admin/motion-graphics/agent-runs/:runId
 *
 * Returns the current run + step list.
 * Polled by useMgAgentRun while the run is active.
 *
 * Authorization (Correction 6): admin + owns the run (enforced by getMgRunWithSteps).
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/motion-graphics/guard";
import { currentUser } from "@clerk/nextjs/server";
import { getMgRunWithSteps } from "@/lib/motion-graphics/mg-run-store";

type Ctx = { params: Promise<{ runId: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const user = await currentUser();
  const userId = user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { runId } = await params;
  const result = await getMgRunWithSteps(userId, runId);

  if (!result) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  return NextResponse.json(result);
}
