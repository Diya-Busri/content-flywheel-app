/**
 * GET  /api/projects/[launchId]/autonomous  — get autonomous mode settings
 * PATCH /api/projects/[launchId]/autonomous  — update settings (enable/disable, schedule)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import { eq, and } from "drizzle-orm";
import type { AutonomousMode } from "@/db/schema/launch-schema";

export const dynamic = "force-dynamic";

const DEFAULT_MODE: AutonomousMode = {
  enabled:      false,
  schedule:     "daily",
  cycleCount:   0,
  currentPhase: "idle",
};

async function getProject(launchId: string, userId: string) {
  const [project] = await db
    .select()
    .from(launchProjectsTable)
    .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)));
  return project ?? null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { launchId: string } },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getProject(params.launchId, userId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const results = (project.stageResults ?? {}) as Record<string, unknown>;
  const mode    = (results.autonomousMode ?? DEFAULT_MODE) as AutonomousMode;

  return NextResponse.json({ mode });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { launchId: string } },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getProject(params.launchId, userId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body    = await req.json().catch(() => ({})) as Partial<AutonomousMode>;
  const results = (project.stageResults ?? {}) as Record<string, unknown>;
  const current = (results.autonomousMode ?? DEFAULT_MODE) as AutonomousMode;
  const updated = { ...current, ...body };

  await db
    .update(launchProjectsTable)
    .set({
      stageResults: {
        ...results,
        autonomousMode: updated,
      } as unknown as typeof launchProjectsTable.$inferInsert["stageResults"],
    })
    .where(and(eq(launchProjectsTable.id, params.launchId), eq(launchProjectsTable.userId, userId)));

  return NextResponse.json({ mode: updated });
}
