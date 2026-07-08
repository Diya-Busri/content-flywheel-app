/**
 * GET /api/projects
 * ──────────────────────────────────────────────────────────────────────────────
 * Returns all of the authenticated user's launch_projects as "Projects",
 * sorted newest-first. Derives projectName, businessStage, scores, and
 * content counts from existing stageResults — no extra DB columns needed.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import type { LaunchStageResults } from "@/db/schema/launch-schema";
import { eq, desc } from "drizzle-orm";

/* ─── Business stage derivation (mirrors LaunchEngine) ──────────────────────── */

const BUSINESS_STAGES = [
  { id: "building",       label: "Building",               minScore: 0  },
  { id: "launching",      label: "Launching",              minScore: 20 },
  { id: "first_visitors", label: "Getting First Visitors", minScore: 40 },
  { id: "first_sales",    label: "Getting First Sales",    minScore: 60 },
  { id: "growing",        label: "Growing",                minScore: 75 },
  { id: "scaling",        label: "Scaling",                minScore: 90 },
];

function deriveBusinessStage(score: number) {
  return BUSINESS_STAGES.reduce(
    (acc, s) => (score >= s.minScore ? s : acc),
    BUSINESS_STAGES[0],
  );
}

/* ─── Launch score calculator (mirrors LaunchEngine) ────────────────────────── */

function calcLaunchScore(r: LaunchStageResults): number {
  let score = 0;
  if (r.research?.insights?.length) score += 20;
  else if (r.research) score += 10;
  if (r.product?.productId) score += 15;
  if (r.design) {
    const a = r.design.assetsCount ?? 0;
    score += a >= 3 ? 15 : a >= 1 ? 8 : 5;
  }
  if (r.marketing) {
    let m = 0;
    if (r.marketing.salesCopy)           m += 5;
    if (r.marketing.emails?.length)      m += 5;
    if (r.marketing.tiktokHooks?.length) m += 4;
    if (r.marketing.carousels?.length)   m += 3;
    if (r.marketing.xPosts?.length)      m += 3;
    score += Math.min(m, 20);
  }
  if (r.store) score += Math.round(((r.store.readinessScore ?? 0) / 100) * 30);
  return Math.min(score, 100);
}

/* ─── Content count ──────────────────────────────────────────────────────────── */

function countContent(r: LaunchStageResults): number {
  const m = r.marketing;
  if (!m) return 0;
  return (
    (m.tiktokHooks?.length     ?? 0) +
    (m.carousels?.length       ?? 0) +
    (m.emails?.length          ?? 0) +
    (m.xPosts?.length          ?? 0) +
    (m.instagramCaptions?.length ?? 0) +
    (m.headlines?.length       ?? 0) +
    (m.ctas?.length            ?? 0) +
    (m.salesCopy ? 1 : 0) +
    (m.launchAnnouncement ? 1 : 0) +
    (m.faq?.length             ?? 0)
  );
}

/* ─── Route handler ──────────────────────────────────────────────────────────── */

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const rows = await db
    .select()
    .from(launchProjectsTable)
    .where(eq(launchProjectsTable.userId, userId))
    .orderBy(desc(launchProjectsTable.updatedAt));

  const projects = rows.map(row => {
    const r = row.stageResults ?? ({} as LaunchStageResults);
    const businessScore = r.brain?.businessScore ?? calcLaunchScore(r);
    const launchScore   = r.brain?.launchScore   ?? null;
    const stage         = deriveBusinessStage(businessScore);

    return {
      id:           row.id,
      goal:         row.goal,
      projectName:  r.product?.productName ?? row.goal,
      status:       row.status,
      currentStage: row.currentStage,
      progress:     row.progress,
      businessScore,
      launchScore,
      businessStage: stage,
      contentCount:  countContent(r),
      storeStatus:   r.store?.storeUrl
        ? "published"
        : r.store?.productId
        ? "draft"
        : "not_built",
      storeUrl:      r.store?.storeUrl ?? null,
      productId:     r.product?.productId ?? null,
      thumbnailUrl:  r.design?.selectedConceptUrl ?? r.design?.concepts?.[0]?.url ?? r.design?.coverUrl ?? r.design?.thumbnailUrl ?? null,
      hasResearch:   !!r.research,
      hasProduct:    !!r.product,
      hasDesign:     !!r.design,
      hasMarketing:  !!r.marketing,
      hasStore:      !!r.store,
      hasBrain:      !!r.brain,
      /* Growth Mode fields */
      pendingTasks:  (r.growth?.aiTasks ?? []).filter(t => t.status === "pending").length,
      healthScore:   r.growth?.report?.healthScore ?? null,
      lastCheckedAt: r.growth?.lastCheckedAt ?? null,
      createdAt:     row.createdAt.toISOString(),
      updatedAt:     row.updatedAt.toISOString(),
    };
  });

  return NextResponse.json({ projects });
}

/**
 * DELETE /api/projects
 * Permanently delete all launch workspaces for the current user.
 */
export async function DELETE() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await db.delete(launchProjectsTable).where(eq(launchProjectsTable.userId, userId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/projects]", err);
    return NextResponse.json({ error: "Failed to delete workspaces" }, { status: 500 });
  }
}
