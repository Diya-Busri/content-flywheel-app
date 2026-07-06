export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/agents/run
 *
 * Trigger agent run(s). Responds immediately; work happens async.
 *
 * Body (optional):
 *   { agentType?: string, forceRun?: boolean }
 *
 * If agentType is omitted, runs all enabled agents.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  type AgentType,
  AGENT_DEFINITIONS,
} from "@/lib/agent-framework";
import { runAllAgents, runSingleAgent } from "@/lib/agent-orchestrator";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";

export async function POST(request: NextRequest) {
  const { userId, sessionClaims } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isAdmin = (sessionClaims?.email as string | undefined) === ADMIN_EMAIL;

  try {
    const body = await request.json().catch(() => ({})) as {
      agentType?: string;
      forceRun?: boolean;
    };

    const forceRun = body.forceRun === true;

    if (body.agentType) {
      if (!(body.agentType in AGENT_DEFINITIONS)) {
        return NextResponse.json({ error: "Invalid agentType" }, { status: 400 });
      }
      // Fire and forget
      void runSingleAgent(userId, body.agentType as AgentType, { isAdmin, forceRun }).catch(() => {});
      return NextResponse.json({ ok: true, message: `${body.agentType} agent started` });
    }

    // Run all agents
    void runAllAgents(userId, { isAdmin, forceRun }).catch(() => {});
    return NextResponse.json({ ok: true, message: "All agents started" });
  } catch (err) {
    console.error("[agents/run]", err);
    return NextResponse.json({ error: "Failed to start agents" }, { status: 500 });
  }
}
