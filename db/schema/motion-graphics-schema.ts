import { pgTable, text, timestamp, uuid, integer, jsonb } from "drizzle-orm/pg-core";
import type {
  Scene,
  TemplateCategory,
  AspectRatio,
  TemplateStatus,
  AssetKind,
  ExportFormat,
  RenderStage,
} from "@/lib/motion-graphics/types";

/**
 * Motion Graphics Studio — DB schema.
 *
 * ADMIN ONLY feature: every row is owned by the single admin user (userId is
 * still stored, matching the app-wide "Clerk user id as plain text" pattern
 * in video-jobs-schema.ts, in case multi-admin support is added later) and
 * every read/write path is gated by lib/motion-graphics/guard.ts.
 */

// ─── Templates ──────────────────────────────────────────────────────────────

export const motionGraphicsTemplatesTable = pgTable("motion_graphics_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  category: text("category").$type<TemplateCategory>().notNull().default("custom"),
  aspectRatio: text("aspect_ratio").$type<AspectRatio>().notNull().default("9:16"),
  fps: integer("fps").notNull().default(30),
  scenes: jsonb("scenes").$type<Scene[]>().notNull().default([]),
  status: text("status").$type<TemplateStatus>().notNull().default("draft"),
  sourceScript: text("source_script"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Assets ─────────────────────────────────────────────────────────────────

export const motionGraphicsAssetsTable = pgTable("motion_graphics_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  kind: text("kind").$type<AssetKind>().notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  durationSeconds: integer("duration_seconds"),
  sizeBytes: integer("size_bytes").notNull().default(0),
  mimeType: text("mime_type").notNull().default("application/octet-stream"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Render jobs ────────────────────────────────────────────────────────────
//
// Persisted (unlike the CF Video Engine's in-memory job-store.ts, which is
// explicitly flagged there as a v2 TODO) so export jobs survive server
// restarts and work across multiple serverless instances.

export const motionGraphicsRenderJobsTable = pgTable("motion_graphics_render_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  templateId: uuid("template_id").notNull(),
  userId: text("user_id").notNull(),
  format: text("format").$type<ExportFormat>().notNull().default("mp4"),
  aspectRatio: text("aspect_ratio").$type<AspectRatio>().notNull().default("9:16"),
  stage: text("stage").$type<RenderStage>().notNull().default("queued"),
  progress: integer("progress").notNull().default(0),
  message: text("message").notNull().default("Queued…"),
  outputUrl: text("output_url"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});
