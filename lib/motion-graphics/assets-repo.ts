/**
 * Motion Graphics Studio — Assets repository.
 * Thin data-access layer over motion_graphics_assets, shared by every
 * app/api/admin/motion-graphics/assets/* route.
 */

import { eq, desc } from "drizzle-orm";
import { db } from "@/db/db";
import { motionGraphicsAssetsTable } from "@/db/schema/motion-graphics-schema";
import { del as deleteFromR2 } from "@/lib/storage";
import type { AssetKind, MotionGraphicsAsset } from "@/lib/motion-graphics/types";

type Row = typeof motionGraphicsAssetsTable.$inferSelect;

function rowToAsset(row: Row): MotionGraphicsAsset {
  return {
    id: row.id,
    userId: row.userId,
    kind: row.kind,
    name: row.name,
    url: row.url,
    thumbnailUrl: row.thumbnailUrl ?? undefined,
    durationSeconds: row.durationSeconds ?? undefined,
    sizeBytes: row.sizeBytes,
    mimeType: row.mimeType,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listAssets(userId: string, kind?: AssetKind): Promise<MotionGraphicsAsset[]> {
  const rows = await db
    .select()
    .from(motionGraphicsAssetsTable)
    .where(eq(motionGraphicsAssetsTable.userId, userId))
    .orderBy(desc(motionGraphicsAssetsTable.createdAt));
  return rows.map(rowToAsset).filter((a) => !kind || a.kind === kind);
}

export async function createAsset(
  userId: string,
  params: Omit<MotionGraphicsAsset, "id" | "userId" | "createdAt">
): Promise<MotionGraphicsAsset> {
  const [row] = await db
    .insert(motionGraphicsAssetsTable)
    .values({
      userId,
      kind: params.kind,
      name: params.name,
      url: params.url,
      thumbnailUrl: params.thumbnailUrl,
      durationSeconds: params.durationSeconds,
      sizeBytes: params.sizeBytes,
      mimeType: params.mimeType,
    })
    .returning();
  return rowToAsset(row);
}

export async function deleteAsset(assetId: string): Promise<void> {
  const [row] = await db
    .select()
    .from(motionGraphicsAssetsTable)
    .where(eq(motionGraphicsAssetsTable.id, assetId))
    .limit(1);
  if (!row) return;

  await db.delete(motionGraphicsAssetsTable).where(eq(motionGraphicsAssetsTable.id, assetId));

  try {
    await deleteFromR2(row.url);
  } catch (err) {
    // Row is already gone from the DB — log and move on rather than
    // failing the delete request over a storage-side cleanup issue.
    console.error("[assets-repo] failed to delete R2 object for asset", assetId, err);
  }
}
