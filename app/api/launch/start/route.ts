/**
 * POST /api/launch/start
 * Creates a new AI launch project and returns { launchId }.
 */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const goal = typeof body.goal === "string" ? body.goal.trim() : "";

    if (!goal) return NextResponse.json({ error: "Goal is required" }, { status: 400 });

    const [project] = await db
      .insert(launchProjectsTable)
      .values({ userId, goal, status: "running", currentStage: "research" })
      .returning({ id: launchProjectsTable.id });

    if (!project?.id) return NextResponse.json({ error: "Failed to create project" }, { status: 500 });

    return NextResponse.json({ launchId: project.id });
  } catch (err) {
    console.error("[launch/start]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
