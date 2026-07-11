/**
 * Motion Graphics Studio — Templates repository.
 * Thin data-access layer over motion_graphics_templates, shared by every
 * app/api/admin/motion-graphics/templates/* route so query shape + row
 * mapping live in exactly one place.
 */

import { eq, desc } from "drizzle-orm";
import { db } from "@/db/db";
import { motionGraphicsTemplatesTable } from "@/db/schema/motion-graphics-schema";
import type { Template, TemplateDraft } from "@/lib/motion-graphics/types";

type Row = typeof motionGraphicsTemplatesTable.$inferSelect;

function rowToTemplate(row: Row): Template {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    category: row.category,
    aspectRatio: row.aspectRatio,
    fps: row.fps,
    scenes: row.scenes,
    status: row.status,
    sourceScript: row.sourceScript ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listTemplates(userId: string): Promise<Template[]> {
  const rows = await db
    .select()
    .from(motionGraphicsTemplatesTable)
    .where(eq(motionGraphicsTemplatesTable.userId, userId))
    .orderBy(desc(motionGraphicsTemplatesTable.updatedAt));
  return rows.map(rowToTemplate);
}

export async function getTemplate(templateId: string): Promise<Template | undefined> {
  const [row] = await db
    .select()
    .from(motionGraphicsTemplatesTable)
    .where(eq(motionGraphicsTemplatesTable.id, templateId))
    .limit(1);
  return row ? rowToTemplate(row) : undefined;
}

export async function createTemplate(userId: string, draft: TemplateDraft): Promise<Template> {
  const [row] = await db
    .insert(motionGraphicsTemplatesTable)
    .values({
      userId,
      name: draft.name,
      category: draft.category,
      aspectRatio: draft.aspectRatio,
      fps: draft.fps,
      scenes: draft.scenes,
      status: draft.status,
      sourceScript: draft.sourceScript,
    })
    .returning();
  return rowToTemplate(row);
}

export async function updateTemplate(
  templateId: string,
  patch: Partial<Pick<Template, "name" | "category" | "aspectRatio" | "fps" | "scenes" | "status">>
): Promise<Template | undefined> {
  const [row] = await db
    .update(motionGraphicsTemplatesTable)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(motionGraphicsTemplatesTable.id, templateId))
    .returning();
  return row ? rowToTemplate(row) : undefined;
}

export async function deleteTemplate(templateId: string): Promise<void> {
  await db.delete(motionGraphicsTemplatesTable).where(eq(motionGraphicsTemplatesTable.id, templateId));
}
