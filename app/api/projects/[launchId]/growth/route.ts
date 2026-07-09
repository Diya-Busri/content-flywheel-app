/**
 * /api/projects/[launchId]/growth
 * ──────────────────────────────────────────────────────────────────────────────
 * Phase 6 — Growth Mode API
 *
 * GET  — list tasks + reviews (current state)
 * POST — trigger a manual growth review  { type?: "daily"|"weekly"|"manual" }
 * PATCH — update a task status           { taskId, status }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import type { GrowthReviewType } from "@/db/schema/launch-schema";
import { eq, and } from "drizzle-orm";
import { runGrowthReview, updateGrowthTaskStatus } from "@/lib/growth-engine";

export const maxDuration = 120;

const VALID_REVIEW_TYPES = new Set<GrowthReviewType>(["daily", "weekly", "manual"]);
const VALID_STATUSES      = new Set(["done", "dismissed", "in_progress"]);

/* ─── GET ────────────────────────────────────────────────────────────────────── */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ launchId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { launchId } = await params;

  const [row] = await db
    .select({ stageResults: launchProjectsTable.stageResults })
    .from(launchProjectsTable)
    .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)));

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const r = row.stageResults ?? {};
  return NextResponse.json({
    tasks:   r.growthTasks   ?? [],
    reviews: r.growthReviews ?? [],
  });
}

/* ─── POST — trigger review ──────────────────────────────────────────────────── */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ launchId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { launchId } = await params;

  let reviewType: GrowthReviewType = "manual";
  try {
    const body = await req.json() as { type?: string };
    if (body.type && VALID_REVIEW_TYPES.has(body.type as GrowthReviewType)) {
      reviewType = body.type as GrowthReviewType;
    }
  } catch { /* default manual */ }

  try {
    const { review, newTasks } = await runGrowthReview(launchId, userId, reviewType);
    return NextResponse.json({ review, newTasks });
  } catch (err) {
    console.error("[growth] review failed:", err);
    return NextResponse.json({ error: "Review failed" }, { status: 500 });
  }
}

/* ─── PATCH — update task status ─────────────────────────────────────────────── */

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ launchId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { launchId } = await params;

  const body = await req.json() as { taskId?: string; status?: string };
  if (!body.taskId || !VALID_STATUSES.has(body.status ?? "")) {
    return NextResponse.json({ error: "taskId and valid status required" }, { status: 400 });
  }

  await updateGrowthTaskStatus(
    launchId,
    userId,
    body.taskId,
    body.status as "done" | "dismissed" | "in_progress",
  );

  return NextResponse.json({ ok: true });
}
