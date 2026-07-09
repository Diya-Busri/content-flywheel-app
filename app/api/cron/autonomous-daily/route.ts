/**
 * GET /api/cron/autonomous-daily
 * ──────────────────────────────────────────────────────────────────────────────
 * Vercel cron — runs every day at 07:00 UTC.
 * Iterates all active projects where autonomousMode.enabled = true
 * and schedule = "daily", then fires one autonomous cycle per project.
 *
 * Secured by CRON_SECRET env var.
 * One failure never stops the rest — all projects are attempted.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import { ne } from "drizzle-orm";
import { runAutonomousCycle } from "@/lib/autonomous-orchestrator";
import type { AutonomousMode, LaunchStageResults } from "@/db/schema/launch-schema";

export const maxDuration = 300;

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projects = await db
    .select({
      id:           launchProjectsTable.id,
      userId:       launchProjectsTable.userId,
      status:       launchProjectsTable.status,
      stageResults: launchProjectsTable.stageResults,
    })
    .from(launchProjectsTable)
    .where(ne(launchProjectsTable.status, "queued"));

  // Filter to projects with autonomous mode enabled + daily schedule
  const eligible = projects.filter(p => {
    const results = (p.stageResults ?? {}) as LaunchStageResults;
    const mode    = results.autonomousMode as AutonomousMode | undefined;
    return mode?.enabled === true && mode?.schedule === "daily";
  });

  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (const project of eligible) {
    try {
      const result = await runAutonomousCycle(project.id, project.userId);
      results.push({ id: project.id, ok: result.ok, error: result.error });
    } catch (err) {
      results.push({
        id:    project.id,
        ok:    false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const succeeded = results.filter(r => r.ok).length;
  const failed    = results.filter(r => !r.ok).length;

  return NextResponse.json({
    ran:       eligible.length,
    succeeded,
    failed,
    results,
  });
}
