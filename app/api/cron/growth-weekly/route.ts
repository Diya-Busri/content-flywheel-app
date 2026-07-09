/**
 * GET /api/cron/growth-weekly
 * ──────────────────────────────────────────────────────────────────────────────
 * Vercel cron — runs every Monday at 07:00 UTC.
 * Runs a deeper weekly strategic review across all active projects.
 *
 * Weekly reviews generate more tasks (up to 10 vs 5 for daily) and think
 * more strategically — campaigns, positioning, long-term opportunities.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import { ne } from "drizzle-orm";
import { runGrowthReview } from "@/lib/growth-engine";

export const maxDuration = 300;

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
      const { newTasks } = await runGrowthReview(project.id, project.userId, "weekly");
      results.push({ id: project.id, ok: true, tasks: newTasks.length });
    } catch (err) {
      results.push({
        id:    project.id,
        ok:    false,
        tasks: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const succeeded = results.filter(r => r.ok).length;
  const total     = results.length;
  const taskCount = results.reduce((s, r) => s + r.tasks, 0);

  console.log(`[growth-weekly] ${succeeded}/${total} projects reviewed, ${taskCount} tasks generated`);

  return NextResponse.json({
    ok:       true,
    reviewed: total,
    succeeded,
    taskCount,
    results,
  });
}
