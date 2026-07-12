/**
 * POST /api/jarvis/runs/[runId]/generate — approves the plan and generates
 * every asset it calls for. Returns once generation has fully completed (or
 * failed) — no held-open connection.
 *
 * Body: { answers?: Record<string, string> } — answers to the plan's
 * missingInfo questions, merged into the run's stored plan before generating.
 *
 * Idempotent: runGenerationPhase()'s compare-and-swap requires the run to be
 * in awaiting_approval/plan_review (or failed, to allow retry) — a run
 * already in asset_review, or a double-click racing the first call, gets the
 * current state back without regenerating anything or spending AI calls
 * twice.
 */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { getStepsForRun } from "@/lib/jarvis/run-store";
import { runGenerationPhase } from "@/lib/jarvis/orchestrator";

function parseAnswers(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof k === "string" && typeof v === "string" && k.length <= 100 && v.length <= 2000) {
      out[k] = v;
    }
  }
  return out;
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
    const answers = parseAnswers(body.answers);

    const result = await runGenerationPhase(userId, runId, answers);

    if (result.status === "not_found") {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    if (result.status === "invalid_state") {
      return NextResponse.json({ error: result.message, run: result.run }, { status: 409 });
    }

    const steps = await getStepsForRun(userId, result.run.id);
    return NextResponse.json({ run: result.run, steps });
  } catch (err) {
    console.error("[jarvis/runs/:id/generate POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
