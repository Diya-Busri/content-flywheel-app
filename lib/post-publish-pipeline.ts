/**
 * lib/post-publish-pipeline.ts — Phase 6.0
 * ──────────────────────────────────────────────────────────────────────────────
 * Automated feedback loop triggered after every successful publish.
 *
 * Pipeline:
 *   1. Try real platform metrics (fetchRealMetrics) — fall back to simulateMetrics
 *   2. Create PostAnalytics entry
 *   3. Run AI analysis (qualitative insights) on the new post
 *   4. Check for viral threshold → viral_post notification
 *   5. If >= 2 analysed posts → run Learning Cycle (extract lessons, update trends)
 *   6. Merge all memory facts into Business Memory
 *   7. Create in-app notifications
 *   8. Save final state to DB
 *   9. Return notifications for the caller to acknowledge
 *
 * Called by publish/route.ts and approve/route.ts inside a try/catch — a pipeline
 * failure must never break the main publish response.
 */

import { db } from "@/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import { eq } from "drizzle-orm";
import type {
  PublishedItem,
  MarketingManagerId,
  LaunchStageResults,
  AnalyticsDepartment,
  PostAnalytics,
  AppNotification,
  NotificationEvent,
} from "@/db/schema/launch-schema";
import { simulateMetrics, extractContentMetadata, analyzePost } from "@/lib/analytics-ai";
import { mergeMemoryFacts } from "@/lib/memory-context";
import { runLearningCycle, buildTrends, mergeLessons } from "@/lib/learning-loop";
import { fetchRealMetrics } from "@/lib/platform-analytics";

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function uid() { return Math.random().toString(36).slice(2, 10); }

/** Viral thresholds per platform (views) */
const VIRAL_THRESHOLDS: Record<MarketingManagerId, number> = {
  tiktok:    100_000,
  instagram:  50_000,
  youtube:    50_000,
  x:          20_000,
  linkedin:   10_000,
  email:       5_000,  // opens
  seo:         5_000,
};

function makeNotification(
  event:     NotificationEvent,
  title:     string,
  message:   string,
  launchId:  string,
  managerId?: MarketingManagerId,
  href?:     string,
): AppNotification {
  return {
    id:        uid(),
    event,
    title,
    message,
    read:      false,
    href:      href ?? `/dashboard/projects/${launchId}/analytics`,
    managerId,
    createdAt: new Date().toISOString(),
  };
}

/* ─── Main pipeline ──────────────────────────────────────────────────────────── */

export async function runPostPublishPipeline(
  launchId:      string,
  userId:        string,
  publishedItem: PublishedItem,
  managerId:     MarketingManagerId,
): Promise<AppNotification[]> {

  /* ── 1. Load fresh project state ─────────────────────────────────────────── */
  const [project] = await db
    .select()
    .from(launchProjectsTable)
    .where(eq(launchProjectsTable.id, launchId))
    .limit(1);

  if (!project) return [];

  const results  = project.stageResults ?? ({} as LaunchStageResults);
  const existing = results.analyticsDept ?? {
    posts: [], recommendations: [], reports: [],
  } as AnalyticsDepartment;

  const notifications: AppNotification[] = [];
  const now = new Date().toISOString();

  /* ── 2. Create PostAnalytics entry ─────────────────────────────────────────── */

  // Avoid duplicate entries for the same publishedItem
  const alreadyTracked = existing.posts.some(p => p.publishedItemId === publishedItem.id);
  if (alreadyTracked) return [];

  // Try real platform metrics first; fall back to simulation if not connected or fetch fails
  const realMetrics = await fetchRealMetrics(userId, publishedItem).catch(() => null);
  const metrics = realMetrics ?? simulateMetrics(managerId, publishedItem.content, publishedItem.publishedAt);
  const metadata = extractContentMetadata(publishedItem.content, managerId);

  const newPost: PostAnalytics = {
    id:              uid(),
    managerId,
    publishedItemId: publishedItem.id,
    platform:        managerId,
    publishedAt:     publishedItem.publishedAt,
    content:         publishedItem.content,
    metadata,
    metrics,
    insights:        [],
  };

  /* ── 3. Publish-success notification ────────────────────────────────────────── */
  notifications.push(makeNotification(
    "publish_success",
    `Published on ${managerId.charAt(0).toUpperCase() + managerId.slice(1)}`,
    `Content is live. Analytics will sync automatically.`,
    launchId,
    managerId,
    `/dashboard/projects/${launchId}/marketing-dept`,
  ));

  /* ── 4. Run AI analysis on the new post ─────────────────────────────────────── */
  let analysedPost = newPost;
  let analyticsMemoryFacts: ReturnType<typeof mergeMemoryFacts>[0][] = [];

  try {
    const { insights, memoryFacts } = await analyzePost(newPost, results);
    analysedPost = { ...newPost, insights, analysedAt: now };
    analyticsMemoryFacts = memoryFacts;

    notifications.push(makeNotification(
      "analytics_complete",
      `${managerId.charAt(0).toUpperCase() + managerId.slice(1)} post analysed`,
      insights.length > 0
        ? `"${insights[0].text.slice(0, 80)}…"`
        : "AI analysis complete.",
      launchId,
      managerId,
    ));
  } catch { /* analytics failure — proceed with unanalysed post */ }

  /* ── 5. Viral check ─────────────────────────────────────────────────────────── */
  const threshold = VIRAL_THRESHOLDS[managerId] ?? 50_000;
  if ((metrics.views ?? 0) >= threshold) {
    notifications.push(makeNotification(
      "viral_post",
      `🔥 Viral post on ${managerId}!`,
      `${(metrics.views ?? 0).toLocaleString()} views — your ${managerId} post is taking off.`,
      launchId,
      managerId,
    ));
  }

  /* ── 6. Merge posts into analytics dept ─────────────────────────────────────── */
  const updatedPosts = [...existing.posts, analysedPost];
  let updatedDept: AnalyticsDepartment = { ...existing, posts: updatedPosts };

  /* ── 7. Update Business Memory ──────────────────────────────────────────────── */
  const existingMem = results.memory ?? { facts: [] };
  let updatedMem    = { ...existingMem };

  if (analyticsMemoryFacts.length > 0) {
    const merged = mergeMemoryFacts(existingMem.facts, analyticsMemoryFacts);
    updatedMem = { ...existingMem, facts: merged, lastExtractedAt: now };
  }

  /* ── 8. Run Learning Cycle if >= 2 analysed posts ───────────────────────────── */
  const nowAnalysed = updatedPosts.filter(p => p.analysedAt && p.insights.length > 0);

  if (nowAnalysed.length >= 2) {
    try {
      const { lessons: newLessons, todaysSummary, memoryFacts: learnFacts } = await runLearningCycle(
        nowAnalysed,
        { ...results, analyticsDept: updatedDept, memory: updatedMem },
        updatedDept.lessons ?? [],
      );

      const mergedLessons = mergeLessons(updatedDept.lessons ?? [], newLessons);
      const trends        = buildTrends(updatedPosts);
      const mergedLFacts  = mergeMemoryFacts(updatedMem.facts, learnFacts);

      updatedMem  = { ...updatedMem, facts: mergedLFacts, lastExtractedAt: now };
      updatedDept = {
        ...updatedDept,
        lessons:        mergedLessons,
        trends,
        todaysSummary,
        learningCycles: (updatedDept.learningCycles ?? 0) + 1,
        lastLearnedAt:  now,
      };

      if (newLessons.length > 0) {
        notifications.push(makeNotification(
          "new_lesson",
          `${newLessons.length} new lesson${newLessons.length !== 1 ? "s" : ""} learned`,
          todaysSummary
            ? todaysSummary.slice(0, 100) + (todaysSummary.length > 100 ? "…" : "")
            : `The AI extracted ${newLessons.length} new reusable lesson${newLessons.length !== 1 ? "s" : ""} from your published content.`,
          launchId,
          managerId,
        ));
      }
    } catch { /* learning failure is best-effort */ }
  }

  /* ── 9. Persist all updates ─────────────────────────────────────────────────── */
  const existingNotifs = results.notifications ?? [];
  const updatedNotifs  = [...notifications, ...existingNotifs].slice(0, 100); // cap at 100

  await db
    .update(launchProjectsTable)
    .set({
      stageResults: {
        ...results,
        analyticsDept: { ...updatedDept, lastAnalysedAt: now },
        memory:        updatedMem,
        notifications: updatedNotifs,
      },
      updatedAt: new Date(),
    })
    .where(eq(launchProjectsTable.id, launchId));

  return notifications;
}
