/**
 * POST /api/jarvis/runs/[runId]/approve — saves only the approved assets
 * into the user's library (scripts) / email marketing (drafts), then marks
 * the run completed. Never publishes, sends, or spends anything beyond the
 * AI generation that already happened.
 *
 * Body: { approvedAssetIds?: string[] } — asset ids to save; every other
 * asset on the run is marked "rejected" and never saved. Omit entirely to
 * retry a previously-failed save with the same selection as last time.
 *
 * Idempotent: runSavePhase()'s compare-and-swap (status + gate) means a
 * double-click or refresh mid-save can never save the same assets twice —
 * the second caller gets the current (already-saving-or-saved) state back.
 */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { getStepsForRun } from "@/lib/jarvis/run-store";
import { runSavePhase } from "@/lib/jarvis/orchestrator";

function parseApprovedIds(raw: unknown): string[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === "string" && id.length > 0).slice(0, 20);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const [userId, unauthorized] = await requireAuth();
    if (unauthorized) return unauthorized;

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const { runId } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const approvedAssetIds = parseApprovedIds(body.approvedAssetIds);

    const result = await runSavePhase(userId, runId, approvedAssetIds);

    if (result.status === "not_found") {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    if (result.status === "invalid_state") {
      return NextResponse.json({ error: result.message, run: result.run }, { status: 409 });
    }

    const steps = await getStepsForRun(userId, result.run.id);
    return NextResponse.json({ run: result.run, steps });
  } catch (err) {
    console.error("[jarvis/runs/:id/approve POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
