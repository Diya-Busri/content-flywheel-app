/**
 * GET /api/jarvis/runs/[runId] — fetch a run and its steps.
 *
 * This is what makes a page refresh safe: the client never trusts in-memory
 * state, it always re-fetches the run here and re-renders whatever gate
 * (plan_review / asset_review) or terminal state the DB says it's in.
 *
 * Ownership: getRunForUser / getStepsForRun both filter by the authenticated
 * userId. A run that exists but belongs to another user returns 404 — not
 * 403 — so existence of another user's run is never revealed.
 */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getRunForUser, getStepsForRun } from "@/lib/jarvis/run-store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const [userId, unauthorized] = await requireAuth();
    if (unauthorized) return unauthorized;

    const { runId } = await params;
    const run = await getRunForUser(userId, runId);
    if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

    const steps = await getStepsForRun(userId, runId);
    return NextResponse.json({ run, steps });
  } catch (err) {
    console.error("[jarvis/runs/:id GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
