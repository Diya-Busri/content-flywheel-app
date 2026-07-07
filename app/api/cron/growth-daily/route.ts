/**
 * GET /api/cron/growth-daily
 * ──────────────────────────────────────────────────────────────────────────────
 * Vercel cron — runs every day at 06:00 UTC.
 * Iterates all active launch projects and runs a daily growth review on each.
 *
 * Secured by CRON_SECRET env var (Vercel sets the Authorization header).
 * Falls through to all projects even if one fails.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import { ne } from "drizzle-orm";
import { runGrowthReview } from "@/lib/growth-engine";

export const maxDuration = 300; // 5 min — batch across all projects

/* ─── Auth ───────────────────────────────────────────────────────────────────── */

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev: allow unauthenticated
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/* ─── Handler ────────────────────────────────────────────────────────────────── */

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all active projects (exclude archived/deleted)
  const projects = await db
    .select({
      id:     launchProjectsTable.id,
      userId: launchProjectsTable.userId,
      status: launchProjectsTable.status,
    })
    .from(launchProjectsTable)
    .where(ne(launchProjectsTable.status, "queued"));

  const results: Array<{ id: string; ok: boolean; tasks: number; error?: string }> = [];

  for (const project of projects) {
    try {
      const { newTasks } = await runGrowthReview(project.id, project.userId, "daily");
      results.push({ id: project.id, ok: true, tasks: newTasks.length });
    } catch (err) {
      results.push({
        id: project.id,
        ok: false,
        tasks: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const succeeded = results.filter(r => r.ok).length;
  const total     = results.length;
  const taskCount = results.reduce((s, r) => s + r.tasks, 0);

  console.log(`[growth-daily] ${succeeded}/${total} projects reviewed, ${taskCount} tasks generated`);

  return NextResponse.json({
    ok:         true,
    reviewed:   total,
    succeeded,
    taskCount,
    results,
  });
}
