/**
 * POST /api/jarvis/runs/[runId]/cancel — cancels a run that hasn't
 * completed yet. Nothing generated so far is deleted (steps/assets stay in
 * the audit log); the run simply stops being actionable.
 */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getRunForUser, transitionRunStatus } from "@/lib/jarvis/run-store";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const [userId, unauthorized] = await requireAuth();
    if (unauthorized) return unauthorized;

    const { runId } = await params;
    const run = await getRunForUser(userId, runId);
    if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

    const updated = await transitionRunStatus(
      userId,
      runId,
      ["queued", "planning", "awaiting_approval", "failed"],
      "cancelled",
      { currentGate: null },
    );

    return NextResponse.json({ run: updated ?? run });
  } catch (err) {
    console.error("[jarvis/runs/:id/cancel POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
