/**
 * GET /api/projects/[launchId]/activity
 * Returns the activity feed (newest first, capped at 500).
 * Optional ?department=marketing|research|... to filter.
 * Optional ?limit=N to limit results (default 50).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import { eq, and } from "drizzle-orm";
import type { ActivityEvent } from "@/db/schema/launch-schema";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
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
  let   feed    = (results.activityFeed ?? []) as ActivityEvent[];

  const url        = new URL(req.url);
  const department = url.searchParams.get("department");
  const limit      = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 500);

  if (department) {
    feed = feed.filter(e => e.department === department);
  }

  return NextResponse.json({
    events: feed.slice(0, limit),
    total:  feed.length,
  });
}
