export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET  /api/agents  — list all agents with preferences + last run info
 * PUT  /api/agents  { agentType, isEnabled } — toggle agent on/off
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { agentRunsTable } from "@/db/schema/agent-runs-schema";
import { eq, and, desc } from "drizzle-orm";
import {
  type AgentType,
  AGENT_DEFINITIONS,
  getAgentPreferences,
  upsertAgentPreference,
} from "@/lib/agent-framework";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [preferences, recentRuns] = await Promise.all([
      getAgentPreferences(userId),
      db.select({
        agentType: agentRunsTable.agentType,
        status: agentRunsTable.status,
        discoveriesCount: agentRunsTable.discoveriesCount,
        completedAt: agentRunsTable.completedAt,
        startedAt: agentRunsTable.startedAt,
      })
        .from(agentRunsTable)
        .where(and(eq(agentRunsTable.userId, userId), eq(agentRunsTable.status, "completed")))
        .orderBy(desc(agentRunsTable.completedAt))
        .limit(50),
    ]);

    // Build per-agent last run map
    const lastRuns: Record<string, { completedAt: string; discoveriesCount: number }> = {};
    for (const run of recentRuns) {
      if (!lastRuns[run.agentType] && run.completedAt) {
        lastRuns[run.agentType] = {
          completedAt: run.completedAt.toISOString(),
          discoveriesCount: run.discoveriesCount,
        };
      }
    }

    const agents = (Object.entries(AGENT_DEFINITIONS) as [AgentType, typeof AGENT_DEFINITIONS[AgentType]][]).map(
      ([type, def]) => ({
        agentType: type,
        ...def,
        isEnabled: preferences[type],
        lastRunAt: lastRuns[type]?.completedAt ?? null,
        lastDiscoveriesCount: lastRuns[type]?.discoveriesCount ?? 0,
      }),
    );

    return NextResponse.json(agents);
  } catch (err) {
    console.error("[agents GET]", err);
    return NextResponse.json({ error: "Failed to fetch agents" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json() as { agentType?: string; isEnabled?: boolean };
    if (!body.agentType || typeof body.isEnabled !== "boolean") {
      return NextResponse.json({ error: "agentType and isEnabled required" }, { status: 400 });
    }
    if (!(body.agentType in AGENT_DEFINITIONS)) {
      return NextResponse.json({ error: "Invalid agentType" }, { status: 400 });
    }

    await upsertAgentPreference(userId, body.agentType as AgentType, body.isEnabled);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[agents PUT]", err);
    return NextResponse.json({ error: "Failed to update preference" }, { status: 500 });
  }
}
