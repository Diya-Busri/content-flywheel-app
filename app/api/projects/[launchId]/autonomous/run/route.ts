/**
 * POST /api/projects/[launchId]/autonomous/run
 * Triggers one autonomous company cycle (background, responds immediately).
 * Guards against concurrent runs by checking currentPhase.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import { eq, and } from "drizzle-orm";
import { runAutonomousCycle } from "@/lib/autonomous-orchestrator";
import type { AutonomousMode } from "@/db/schema/launch-schema";

export const dynamic  = "force-dynamic";
export const maxDuration = 300; // 5 min max — Vercel Pro

export async function POST(
  _req: NextRequest,
  { params }: { params: { launchId: string } },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [project] = await db
    .select()
    .from(launchProjectsTable)
    .where(and(eq(launchProjectsTable.id, params.launchId), eq(launchProjectsTable.userId, userId)));

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const results = (project.stageResults ?? {}) as Record<string, unknown>;
  const mode    = results.autonomousMode as AutonomousMode | undefined;

  // Guard concurrent runs
  const running = ["research", "marketing", "design", "analytics", "learning", "memory", "briefing"];
  if (mode?.currentPhase && running.includes(mode.currentPhase)) {
    return NextResponse.json(
      { error: "Cycle already running", phase: mode.currentPhase },
      { status: 409 },
    );
  }

  // Fire-and-forget — don't await (Vercel will keep the fn alive via maxDuration)
  runAutonomousCycle(params.launchId, userId).catch(console.error);

  return NextResponse.json({ ok: true, message: "Cycle started" });
}
