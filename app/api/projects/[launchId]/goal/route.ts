/**
 * PATCH /api/projects/[launchId]/goal
 * Set or update the business goal for a project.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import type { LaunchStageResults, ProjectGoal } from "@/db/schema/launch-schema";
import { eq, and } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ launchId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { launchId } = await params;
  const body = await req.json() as Partial<ProjectGoal>;

  const [project] = await db
    .select()
    .from(launchProjectsTable)
    .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)))
    .limit(1);

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const results = project.stageResults ?? ({} as LaunchStageResults);
  const growth  = results.growth ?? {};

  const goal: ProjectGoal = {
    type:    body.type    ?? "first_sale",
    label:   body.label   ?? "First Sale",
    target:  body.target  ?? 1,
    current: body.current ?? 0,
    unit:    body.unit    ?? "sales",
  };

  const updated = { ...results, growth: { ...growth, goal } };

  await db
    .update(launchProjectsTable)
    .set({ stageResults: updated, updatedAt: new Date() })
    .where(eq(launchProjectsTable.id, launchId));

  return NextResponse.json({ goal });
}
