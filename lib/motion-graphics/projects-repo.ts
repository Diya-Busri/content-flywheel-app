/**
 * Motion Graphics Studio — Content Projects repository.
 * Data-access layer over motion_graphics_projects.
 */

import { eq, desc } from "drizzle-orm";
import { db } from "@/db/db";
import { motionGraphicsProjectsTable } from "@/db/schema/motion-graphics-projects-schema";
import type { ContentProject } from "@/lib/motion-graphics/types";

type Row = typeof motionGraphicsProjectsTable.$inferSelect;

function rowToProject(row: Row): ContentProject {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    contentMode: row.contentMode,
    status: row.status,
    sourceText: row.sourceText,
    sourceUrl: row.sourceUrl ?? undefined,
    targetAudience: row.targetAudience ?? undefined,
    mainOpinion: row.mainOpinion ?? undefined,
    desiredCta: row.desiredCta ?? undefined,
    cfMention: row.cfMention,
    videoDuration: row.videoDuration ?? undefined,
    tone: row.tone ?? undefined,
    aspectRatio: row.aspectRatio,
    analysis: row.analysis ?? undefined,
    shortForm: row.shortForm ?? undefined,
    longForm: row.longForm ?? undefined,
    templateId: row.templateId ?? undefined,
    renderJobId: row.renderJobId ?? undefined,
    outputUrl: row.outputUrl ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listProjects(userId: string): Promise<ContentProject[]> {
  const rows = await db
    .select()
    .from(motionGraphicsProjectsTable)
    .where(eq(motionGraphicsProjectsTable.userId, userId))
    .orderBy(desc(motionGraphicsProjectsTable.updatedAt));
  return rows.map(rowToProject);
}

export async function getProject(projectId: string): Promise<ContentProject | undefined> {
  const [row] = await db
    .select()
    .from(motionGraphicsProjectsTable)
    .where(eq(motionGraphicsProjectsTable.id, projectId))
    .limit(1);
  return row ? rowToProject(row) : undefined;
}

export async function createProject(
  userId: string,
  data: Partial<Omit<ContentProject, "id" | "userId" | "createdAt" | "updatedAt">>
): Promise<ContentProject> {
  const [row] = await db
    .insert(motionGraphicsProjectsTable)
    .values({
      userId,
      name: data.name ?? "Untitled Project",
      contentMode: data.contentMode ?? "reddit-reaction",
      status: data.status ?? "draft",
      sourceText: data.sourceText ?? "",
      sourceUrl: data.sourceUrl,
      targetAudience: data.targetAudience,
      mainOpinion: data.mainOpinion,
      desiredCta: data.desiredCta,
      cfMention: data.cfMention ?? "subtle",
      videoDuration: data.videoDuration,
      tone: data.tone,
      aspectRatio: data.aspectRatio ?? "9:16",
      analysis: data.analysis,
      shortForm: data.shortForm,
      longForm: data.longForm,
      templateId: data.templateId,
      renderJobId: data.renderJobId,
      outputUrl: data.outputUrl,
    })
    .returning();
  return rowToProject(row);
}

export async function updateProject(
  projectId: string,
  patch: Partial<Omit<ContentProject, "id" | "userId" | "createdAt" | "updatedAt">>
): Promise<ContentProject | undefined> {
  const [row] = await db
    .update(motionGraphicsProjectsTable)
    .set({
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.contentMode !== undefined && { contentMode: patch.contentMode }),
      ...(patch.status !== undefined && { status: patch.status }),
      ...(patch.sourceText !== undefined && { sourceText: patch.sourceText }),
      ...(patch.sourceUrl !== undefined && { sourceUrl: patch.sourceUrl }),
      ...(patch.targetAudience !== undefined && { targetAudience: patch.targetAudience }),
      ...(patch.mainOpinion !== undefined && { mainOpinion: patch.mainOpinion }),
      ...(patch.desiredCta !== undefined && { desiredCta: patch.desiredCta }),
      ...(patch.cfMention !== undefined && { cfMention: patch.cfMention }),
      ...(patch.videoDuration !== undefined && { videoDuration: patch.videoDuration }),
      ...(patch.tone !== undefined && { tone: patch.tone }),
      ...(patch.aspectRatio !== undefined && { aspectRatio: patch.aspectRatio }),
      ...(patch.analysis !== undefined && { analysis: patch.analysis }),
      ...(patch.shortForm !== undefined && { shortForm: patch.shortForm }),
      ...(patch.longForm !== undefined && { longForm: patch.longForm }),
      ...(patch.templateId !== undefined && { templateId: patch.templateId }),
      ...(patch.renderJobId !== undefined && { renderJobId: patch.renderJobId }),
      ...(patch.outputUrl !== undefined && { outputUrl: patch.outputUrl }),
      updatedAt: new Date(),
    })
    .where(eq(motionGraphicsProjectsTable.id, projectId))
    .returning();
  return row ? rowToProject(row) : undefined;
}

export async function deleteProject(projectId: string): Promise<void> {
  await db.delete(motionGraphicsProjectsTable).where(eq(motionGraphicsProjectsTable.id, projectId));
}
