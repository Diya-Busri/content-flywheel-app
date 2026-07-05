export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET  /api/orchestrator  — current health score + decisions
 * POST /api/orchestrator  — run orchestrator (force refresh decisions)
 * PUT  /api/orchestrator  { id } — mark decision as actioned
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { runOrchestrator, markDecisionActioned } from "@/lib/business-orchestrator";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const state = await runOrchestrator(userId, false);
    return NextResponse.json(state);
  } catch (err) {
    console.error("[orchestrator GET]", err);
    return NextResponse.json({ error: "Failed to load orchestrator state" }, { status: 500 });
  }
}

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const state = await runOrchestrator(userId, true);
    return NextResponse.json(state);
  } catch (err) {
    console.error("[orchestrator POST]", err);
    return NextResponse.json({ error: "Failed to run orchestrator" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json() as { id?: string };
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await markDecisionActioned(userId, body.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[orchestrator PUT]", err);
    return NextResponse.json({ error: "Failed to action decision" }, { status: 500 });
  }
}
