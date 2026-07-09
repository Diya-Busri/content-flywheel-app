/**
 * GET /api/projects/[launchId]/mission-control
 *
 * Returns the current Mission Control data (plan, briefing, memory)
 * without generating anything. The frontend calls this on mount and
 * triggers POST /run if the plan is stale or missing.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ launchId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { launchId } = await params;

  const [project] = await db
    .select({ stageResults: launchProjectsTable.stageResults })
    .from(launchProjectsTable)
    .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)))
    .limit(1);

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const mc = project.stageResults?.missionControl ?? null;
  return NextResponse.json({ missionControl: mc });
}
