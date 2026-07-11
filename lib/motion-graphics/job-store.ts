/**
 * Motion Graphics Studio — Persisted Render Job Store
 *
 * Backed by the `motion_graphics_render_jobs` table instead of an in-memory
 * Map. This deliberately fixes a known limitation of the CF Video Engine's
 * lib/video-engine/job-store.ts (in-memory only, anchored on `globalThis`,
 * explicitly documented there as a "TODO v2: persist to DB" — jobs vanish on
 * server restart and can't be shared across multiple serverless instances).
 * Motion Graphics Studio jobs survive both.
 */

import { eq, desc } from "drizzle-orm";
import { db } from "@/db/db";
import { motionGraphicsRenderJobsTable } from "@/db/schema/motion-graphics-schema";
import type {
  AspectRatio,
  ExportFormat,
  MotionGraphicsRenderJob,
  RenderStage,
} from "@/lib/motion-graphics/types";

type Row = typeof motionGraphicsRenderJobsTable.$inferSelect;

function rowToJob(row: Row): MotionGraphicsRenderJob {
  return {
    id: row.id,
    templateId: row.templateId,
    userId: row.userId,
    format: row.format,
    aspectRatio: row.aspectRatio,
    stage: row.stage,
    progress: row.progress,
    message: row.message,
    outputUrl: row.outputUrl ?? undefined,
    error: row.error ?? undefined,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : undefined,
  };
}

export async function createRenderJob(params: {
  templateId: string;
  userId: string;
  format: ExportFormat;
  aspectRatio: AspectRatio;
}): Promise<MotionGraphicsRenderJob> {
  const [row] = await db
    .insert(motionGraphicsRenderJobsTable)
    .values({
      templateId: params.templateId,
      userId: params.userId,
      format: params.format,
      aspectRatio: params.aspectRatio,
      stage: "queued",
      progress: 0,
      message: "Queued…",
    })
    .returning();
  return rowToJob(row);
}

export async function updateRenderJob(
  jobId: string,
  update: Partial<{
    stage: RenderStage;
    progress: number;
    message: string;
    outputUrl: string;
    error: string;
    completedAt: Date;
  }>
): Promise<void> {
  await db.update(motionGraphicsRenderJobsTable).set(update).where(eq(motionGraphicsRenderJobsTable.id, jobId));
}

export async function getRenderJob(jobId: string): Promise<MotionGraphicsRenderJob | undefined> {
  const [row] = await db
    .select()
    .from(motionGraphicsRenderJobsTable)
    .where(eq(motionGraphicsRenderJobsTable.id, jobId))
    .limit(1);
  return row ? rowToJob(row) : undefined;
}

export async function listRenderJobsForTemplate(templateId: string): Promise<MotionGraphicsRenderJob[]> {
  const rows = await db
    .select()
    .from(motionGraphicsRenderJobsTable)
    .where(eq(motionGraphicsRenderJobsTable.templateId, templateId))
    .orderBy(desc(motionGraphicsRenderJobsTable.createdAt));
  return rows.map(rowToJob);
}
