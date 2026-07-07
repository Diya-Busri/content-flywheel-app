/**
 * POST /api/projects/[launchId]/marketing-dept/[managerId]/approve
 * ──────────────────────────────────────────────────────────────────────────────
 * Manually approves a queued item and publishes it immediately.
 *
 * Body: { queueItemId: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import { connectedAccountsTable } from "@/db/schema/connected-accounts-schema";
import type {
  LaunchStageResults,
  MarketingManagerId,
} from "@/db/schema/launch-schema";
import type { ConnectedPlatform } from "@/db/schema/connected-accounts-schema";
import { eq, and } from "drizzle-orm";
import { executePublish, createPublishedItem, extractPublishMemoryFacts } from "@/lib/publishing-queue";
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

  const { queueItemId } = await req.json().catch(() => ({})) as { queueItemId?: string };
  if (!queueItemId) return NextResponse.json({ error: "queueItemId required" }, { status: 400 });

  /* Load project */
  const [project] = await db
    .select()
    .from(launchProjectsTable)
    .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)))
    .limit(1);

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const results = project.stageResults ?? ({} as LaunchStageResults);
  const dept    = results.marketingDept ?? { managers: {} };
  const manager = dept.managers[mid];

  if (!manager) return NextResponse.json({ error: "Manager not found" }, { status: 404 });

  const item = (manager.publishQueue ?? []).find(i => i.id === queueItemId);
  if (!item) return NextResponse.json({ error: "Queue item not found" }, { status: 404 });
  if (item.status !== "queued" && item.status !== "scheduled") {
    return NextResponse.json({ error: "Item is not pending approval" }, { status: 409 });
  }

  /* Load connection */
  const [connection] = await db
    .select()
    .from(connectedAccountsTable)
    .where(and(eq(connectedAccountsTable.userId, userId), eq(connectedAccountsTable.platform, mid as ConnectedPlatform)))
    .limit(1);

  /* Mark rendering */
  const renderingItem = { ...item, status: "rendering" as const, approvedAt: new Date().toISOString(), approvedBy: "user" as const };
  const queueWithRendering = (manager.publishQueue ?? []).map(i => i.id === queueItemId ? renderingItem : i);
  await db
    .update(launchProjectsTable)
    .set({
      stageResults: { ...results, marketingDept: { ...dept, managers: { ...dept.managers, [mid]: { ...manager, publishQueue: queueWithRendering } } } },
      updatedAt: new Date(),
    })
    .where(eq(launchProjectsTable.id, launchId));

  /* Execute publish */
  const result     = await executePublish(renderingItem, connection ?? null);
  const nowStr     = new Date().toISOString();

  let finalItem = result.success
    ? { ...renderingItem, status: "published" as const, publishedAt: nowStr, publishedUrl: result.publishedUrl }
    : { ...renderingItem, status: "failed" as const, errorMessage: result.errorMessage, retryCount: item.retryCount + 1 };

  const publishedItemRecord = result.success ? createPublishedItem(renderingItem, result) : null;

  /* Update manager state */
  const updatedQueue     = (manager.publishQueue ?? []).map(i => i.id === queueItemId ? finalItem : i);
  const updatedPublished = publishedItemRecord
    ? [...(manager.publishedItems ?? []), publishedItemRecord].slice(-100)
    : (manager.publishedItems ?? []);

  const updatedManager = {
    ...manager,
    publishQueue:   updatedQueue,
    publishedItems: updatedPublished,
    status:         "idle" as const,
  };

  /* Memory facts */
  const memFacts    = publishedItemRecord
    ? extractPublishMemoryFacts(mid, item.outputType, item.content, publishedItemRecord.publishedUrl)
    : [];
  const existingMem = results.memory ?? { facts: [] };
  const merged      = mergeMemoryFacts(existingMem.facts, memFacts);
  const updatedMem  = { ...existingMem, facts: merged, lastExtractedAt: nowStr };

  const finalDept = {
    ...dept,
    managers:    { ...dept.managers, [mid]: updatedManager },
    lastUpdated: nowStr,
  };

  await db
    .update(launchProjectsTable)
    .set({ stageResults: { ...results, marketingDept: finalDept, memory: updatedMem }, updatedAt: new Date() })
    .where(eq(launchProjectsTable.id, launchId));

  return NextResponse.json({ queueItem: finalItem, publishedItem: publishedItemRecord });
}
