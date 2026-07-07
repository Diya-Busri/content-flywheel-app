/**
 * POST /api/projects/[launchId]/marketing-dept/[managerId]/publish
 * ──────────────────────────────────────────────────────────────────────────────
 * Queues a content output for publishing.
 *
 * Body:
 *   {
 *     outputId:    string,
 *     outputType:  string,
 *     content:     string,   // the actual content to publish
 *     scheduleMode?: "immediate" | "scheduled" | "mission_control",
 *     scheduledAt?: string,  // ISO datetime if scheduleMode = "scheduled"
 *   }
 *
 * Flow:
 *   1. Create PublishQueueItem
 *   2. If auto-approve (balanced/autopilot) + immediate → execute publish now
 *   3. If manual → leave as "queued", wait for approve endpoint
 *   4. If scheduled → leave as "scheduled"
 *   5. Save to project + extract memory facts
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import { connectedAccountsTable } from "@/db/schema/connected-accounts-schema";
import type {
  LaunchStageResults,
  MarketingManagerId,
  MarketingDepartment,
  MarketingManager,
  PublishQueueItem,
} from "@/db/schema/launch-schema";
import type { ConnectedPlatform } from "@/db/schema/connected-accounts-schema";
import { eq, and } from "drizzle-orm";
import {
  createQueueItem,
  createPublishedItem,
  executePublish,
  extractPublishMemoryFacts,
  shouldAutoApprove,
} from "@/lib/publishing-queue";
import { mergeMemoryFacts } from "@/lib/memory-context";

export const maxDuration = 60;

const VALID_IDS = new Set<MarketingManagerId>([
  "tiktok", "instagram", "youtube", "x", "linkedin", "email", "seo",
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ launchId: string; managerId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { launchId, managerId } = await params;
  if (!VALID_IDS.has(managerId as MarketingManagerId)) {
    return NextResponse.json({ error: "Invalid manager ID" }, { status: 400 });
  }
  const mid = managerId as MarketingManagerId;

  const body = await req.json().catch(() => ({})) as {
    outputId:     string;
    outputType:   string;
    content:      string;
    scheduleMode?: "immediate" | "scheduled" | "mission_control";
    scheduledAt?: string;
  };

  if (!body.content || !body.outputId) {
    return NextResponse.json({ error: "outputId and content are required" }, { status: 400 });
  }

  /* Load project */
  const [project] = await db
    .select()
    .from(launchProjectsTable)
    .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)))
    .limit(1);

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const results = project.stageResults ?? ({} as LaunchStageResults);
  const dept    = results.marketingDept ?? { managers: {} };
  const manager = dept.managers[mid] ?? { id: mid, status: "idle" as const, queue: [], history: [], outputs: [], suggestions: [], runCount: 0 };
  const publishingConfig = manager.publishingConfig ?? { approvalMode: "manual", schedule: { mode: "immediate" } };

  /* Load platform connection */
  const [connection] = await db
    .select()
    .from(connectedAccountsTable)
    .where(and(eq(connectedAccountsTable.userId, userId), eq(connectedAccountsTable.platform, mid as ConnectedPlatform)))
    .limit(1);

  /* Create queue item */
  const item = createQueueItem({
    managerId:    mid,
    outputId:     body.outputId,
    outputType:   body.outputType,
    content:      body.content,
    approvalMode: publishingConfig.approvalMode,
    scheduledAt:  body.scheduleMode === "scheduled" ? body.scheduledAt : undefined,
  });

  let updatedItem   = item;
  let publishedItem = null;

  /* If auto-approve + immediate → execute now */
  const isImmediate = !body.scheduledAt && body.scheduleMode !== "scheduled";
  const autoApprove = shouldAutoApprove(body.content, body.outputType, publishingConfig.approvalMode);

  if (autoApprove && isImmediate) {
    updatedItem = { ...item, status: "rendering" };

    // Save rendering status first
    const renderingDept = buildUpdatedDept(dept, mid, manager, updatedItem);
    await saveProject(launchId, results, renderingDept);

    // Execute publish
    const result = await executePublish(item, connection ?? null);

    if (result.success) {
      updatedItem   = { ...item, status: "published", publishedAt: new Date().toISOString(), publishedUrl: result.publishedUrl };
      publishedItem = createPublishedItem(item, result);
    } else {
      updatedItem = { ...item, status: "failed", errorMessage: result.errorMessage, retryCount: 1 };
    }
  }

  /* Update manager state */
  const existingQueue    = manager.publishQueue ?? [];
  const existingPublished = manager.publishedItems ?? [];
  const updatedQueue     = [...existingQueue, updatedItem].slice(-50);
  const updatedPublished = publishedItem ? [...existingPublished, publishedItem].slice(-100) : existingPublished;

  const updatedManager: MarketingManager = {
    ...manager,
    publishQueue:    updatedQueue,
    publishedItems:  updatedPublished,
    status: autoApprove && isImmediate ? "idle" : "waiting_approval",
  };

  const finalDept = buildUpdatedDept(dept, mid, updatedManager);

  /* Extract memory facts */
  const memFacts  = publishedItem
    ? extractPublishMemoryFacts(mid, body.outputType, body.content, publishedItem.publishedUrl)
    : [];
  const existingMem = results.memory ?? { facts: [] };
  const mergedFacts = mergeMemoryFacts(existingMem.facts, memFacts);
  const updatedMem  = { ...existingMem, facts: mergedFacts, lastExtractedAt: new Date().toISOString() };

  await saveProject(launchId, { ...results, marketingDept: finalDept, memory: updatedMem }, finalDept);

  return NextResponse.json({
    queueItem:     updatedItem,
    publishedItem: publishedItem ?? undefined,
    status:        updatedItem.status,
  });
}

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function buildUpdatedDept(
  dept:      MarketingDepartment,
  mid:       MarketingManagerId,
  manager:   MarketingManager,
  queueItem?: PublishQueueItem,
): MarketingDepartment {
  const existingQueue     = manager.publishQueue ?? [];
  const publishQueue      = queueItem
    ? [...existingQueue.filter(i => i.id !== queueItem.id), queueItem]
    : existingQueue;
  return {
    ...dept,
    managers: {
      ...dept.managers,
      [mid]: { ...manager, publishQueue },
    },
    lastUpdated: new Date().toISOString(),
  };
}

async function saveProject(
  launchId: string,
  results:  LaunchStageResults,
  dept:     MarketingDepartment,
) {
  await db
    .update(launchProjectsTable)
    .set({ stageResults: { ...results, marketingDept: dept }, updatedAt: new Date() })
    .where(eq(launchProjectsTable.id, launchId));
}
