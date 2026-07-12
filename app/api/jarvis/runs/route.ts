/**
 * POST /api/jarvis/runs — create a new Jarvis run and execute its planning
 * phase (reads business context, analyses the offer, produces a strategy).
 * Returns once planning has fully completed (or failed) — no long-lived
 * connection, no polling inside the request.
 *
 * GET /api/jarvis/runs — list the authenticated user's runs (most recent first).
 */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { createRun, listRunsForUser, getStepsForRun } from "@/lib/jarvis/run-store";
import { runPlanningPhase } from "@/lib/jarvis/orchestrator";

const PLACEHOLDER_GOALS = new Set([
  "test", "testing", "hello", "hi", "hey", "asdf", "qwerty", "foo", "bar", "baz",
  "lorem", "ipsum", "123", "abc", "idk", "i dont know", "not sure", "help",
]);

function validateGoal(raw: unknown): { goal: string } | { error: string } {
  if (typeof raw !== "string") return { error: "Goal is required" };
  const goal = raw.trim();
  if (goal.length < 8) return { error: "Please describe what you'd like Jarvis to accomplish in a bit more detail." };
  if (goal.length > 2000) return { error: "Goal is too long (max 2000 characters)." };
  const norm = goal.toLowerCase().replace(/['"!?.]/g, "").trim();
  if (PLACEHOLDER_GOALS.has(norm)) return { error: "Please enter a real business goal." };
  return { goal };
}

export async function POST(request: NextRequest) {
  try {
    const [userId, unauthorized] = await requireAuth();
    if (unauthorized) return unauthorized;

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const validated = validateGoal(body.goal);
    if ("error" in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const run = await createRun(userId, validated.goal);
    const result = await runPlanningPhase(userId, run.id);

    if (result.status === "not_found") {
      // Should not happen immediately after createRun — defensive only.
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const steps = await getStepsForRun(userId, result.run.id);
    return NextResponse.json({ run: result.run, steps });
  } catch (err) {
    console.error("[jarvis/runs POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const [userId, unauthorized] = await requireAuth();
    if (unauthorized) return unauthorized;

    const runs = await listRunsForUser(userId, 20);
    return NextResponse.json({ runs });
  } catch (err) {
    console.error("[jarvis/runs GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
