/**
 * GET  /api/projects/[launchId]/analytics
 *   → returns { analyticsDept }
 *
 * POST /api/projects/[launchId]/analytics
 *   body { action: "sync" }
 *   → reads all publishedItems from marketingDept, creates PostAnalytics entries
 *     with simulated metrics for any not yet tracked, saves, returns analyticsDept
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import type {
  LaunchStageResults,
  AnalyticsDepartment,
  PostAnalytics,
  MarketingManagerId,
} from "@/db/schema/launch-schema";
import { eq, and } from "drizzle-orm";
import {
  simulateMetrics,
  extractContentMetadata,
} from "@/lib/analytics-ai";

function uid() { return Math.random().toString(36).slice(2, 10); }

/* ── GET ──────────────────────────────────────────────────────────────────────── */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ launchId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { launchId } = await params;

  const [project] = await db
    .select()
    .from(launchProjectsTable)
    .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)))
    .limit(1);

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const results = project.stageResults ?? ({} as LaunchStageResults);
  return NextResponse.json({ analyticsDept: results.analyticsDept ?? null });
}

/* ── POST ─────────────────────────────────────────────────────────────────────── */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ launchId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { launchId } = await params;

  const body = await req.json().catch(() => ({})) as { action?: string };

  const [project] = await db
    .select()
    .from(launchProjectsTable)
    .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)))
    .limit(1);

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const results    = project.stageResults ?? ({} as LaunchStageResults);
  const dept       = results.marketingDept;
  const existing   = results.analyticsDept ?? { posts: [], recommendations: [], reports: [] } as AnalyticsDepartment;

  if (body.action === "sync") {
    const newPosts: PostAnalytics[] = [];
    const trackedIds = new Set(existing.posts.map(p => p.publishedItemId));

    // Walk every manager's publishedItems
    const managers = dept?.managers ?? {};
    for (const [mid, manager] of Object.entries(managers) as [MarketingManagerId, (typeof managers)[string]][]) {
      if (!manager?.publishedItems) continue;

      for (const item of manager.publishedItems) {
        if (trackedIds.has(item.id)) continue; // already synced

        const metadata = extractContentMetadata(item.content, "unknown");
        const metrics  = simulateMetrics(mid, item.content, item.publishedAt);

        newPosts.push({
          id:              uid(),
          managerId:       mid,
          publishedItemId: item.id,
          platform:        mid,
          publishedAt:     item.publishedAt,
          content:         item.content,
          metadata,
          metrics,
          insights:        [],
          analysedAt:      undefined,
        });
      }
    }

    // Also refresh metrics on existing posts (simulate periodic refresh)
    const refreshedPosts = existing.posts.map(p => {
      const lastFetched = p.metrics.lastFetched;
      const ageMs = lastFetched ? Date.now() - new Date(lastFetched).getTime() : Infinity;
      if (ageMs < 60 * 60 * 1000) return p; // skip if fetched < 1h ago
      return { ...p, metrics: simulateMetrics(p.managerId, p.content, p.publishedAt) };
    });

    const updatedDept: AnalyticsDepartment = {
      ...existing,
      posts: [...refreshedPosts, ...newPosts],
    };

    await db
      .update(launchProjectsTable)
      .set({ stageResults: { ...results, analyticsDept: updatedDept }, updatedAt: new Date() })
      .where(eq(launchProjectsTable.id, launchId));

    return NextResponse.json({
      analyticsDept: updatedDept,
      synced:        newPosts.length,
      refreshed:     refreshedPosts.filter((p, i) => p !== existing.posts[i]).length,
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
