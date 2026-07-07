/**
 * GET  /api/launch/[launchId]   — fetch project
 * PATCH /api/launch/[launchId]  — update stage results / status
 */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import type { LaunchStatus, LaunchStageId, LaunchMemory, LaunchStageResults } from "@/db/schema/launch-schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ launchId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { launchId } = await params;
    const [project] = await db
      .select()
      .from(launchProjectsTable)
      .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)))
      .limit(1);

    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(project);
  } catch (err) {
    console.error("[launch/GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ launchId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { launchId } = await params;
    const body = await request.json().catch(() => ({})) as {
      status?: LaunchStatus;
      currentStage?: LaunchStageId;
      progress?: number;
      memory?: LaunchMemory;
      stageResults?: LaunchStageResults;
    };

    const [existing] = await db
      .select({ stageResults: launchProjectsTable.stageResults, memory: launchProjectsTable.memory })
      .from(launchProjectsTable)
      .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)))
      .limit(1);

    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Deep-merge stageResults so partial updates don't wipe other stages
    const mergedResults: LaunchStageResults = { ...(existing.stageResults ?? {}), ...(body.stageResults ?? {}) };
    const mergedMemory: LaunchMemory = { ...(existing.memory ?? {}), ...(body.memory ?? {}) };

    const [updated] = await db
      .update(launchProjectsTable)
      .set({
        ...(body.status                          && { status: body.status }),
        ...(body.currentStage                    && { currentStage: body.currentStage }),
        ...(typeof body.progress === "number"    && { progress: Math.max(0, Math.min(100, body.progress)) }),
        memory:       mergedMemory,
        stageResults: mergedResults,
        updatedAt:    new Date(),
      })
      .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)))
      .returning();

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[launch/PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
