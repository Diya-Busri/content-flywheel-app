/**
 * GET  /api/projects/[launchId]/notifications   — list notifications (newest first)
 * PATCH /api/projects/[launchId]/notifications   — mark read { ids?: string[] } (all if omitted)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import type { LaunchStageResults } from "@/db/schema/launch-schema";
import { eq, and } from "drizzle-orm";

export const maxDuration = 15;

async function loadProject(launchId: string, userId: string) {
  const [project] = await db
    .select()
    .from(launchProjectsTable)
    .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)))
    .limit(1);
  return project ?? null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ launchId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { launchId } = await params;
  const project = await loadProject(launchId, userId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const notifications = project.stageResults?.notifications ?? [];
  const unreadCount   = notifications.filter(n => !n.read).length;

  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ launchId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { launchId } = await params;
  const project = await loadProject(launchId, userId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { ids } = await req.json().catch(() => ({})) as { ids?: string[] };
  const results  = project.stageResults ?? ({} as LaunchStageResults);
  const existing = results.notifications ?? [];

  const updated = existing.map(n => {
    if (!ids || ids.includes(n.id)) return { ...n, read: true };
    return n;
  });

  await db
    .update(launchProjectsTable)
    .set({ stageResults: { ...results, notifications: updated }, updatedAt: new Date() })
    .where(eq(launchProjectsTable.id, launchId));

  const unreadCount = updated.filter(n => !n.read).length;
  return NextResponse.json({ notifications: updated, unreadCount });
}
