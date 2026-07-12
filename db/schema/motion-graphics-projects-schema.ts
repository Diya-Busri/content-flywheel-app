import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import type {
  AspectRatio,
  CfMentionMode,
  ContentAnalysis,
  ContentMode,
  ContentProjectStatus,
  LongFormOutput,
  ShortFormOutput,
} from "@/lib/motion-graphics/types";

/**
 * Motion Graphics Studio — AI Content Projects
 *
 * One row per "source material → storyboard → video" project.
 * The user pastes a Reddit post / complaint → AI generates analysis +
 * shortForm storyboard + longForm plan → user edits scenes → renders.
 *
 * Separate from motion_graphics_templates (which stores the compiled
 * Remotion scene list) — this table stores the richer structured output
 * that drives the storyboard review UX.
 */
export const motionGraphicsProjectsTable = pgTable("motion_graphics_projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull().default("Untitled Project"),
  contentMode: text("content_mode").$type<ContentMode>().notNull().default("reddit-reaction"),
  status: text("status").$type<ContentProjectStatus>().notNull().default("draft"),

  // Source material
  sourceText: text("source_text").notNull().default(""),
  sourceUrl: text("source_url"),
  targetAudience: text("target_audience"),
  mainOpinion: text("main_opinion"),
  desiredCta: text("desired_cta"),
  cfMention: text("cf_mention").$type<CfMentionMode>().notNull().default("subtle"),
  videoDuration: text("video_duration"),
  tone: text("tone"),
  aspectRatio: text("aspect_ratio").$type<AspectRatio>().notNull().default("9:16"),

  // AI-generated output (JSON)
  analysis: jsonb("analysis").$type<ContentAnalysis>(),
  shortForm: jsonb("short_form").$type<ShortFormOutput>(),
  longForm: jsonb("long_form").$type<LongFormOutput>(),

  // Links to compiled Remotion template + render job
  templateId: uuid("template_id"),
  renderJobId: uuid("render_job_id"),
  outputUrl: text("output_url"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type InsertMotionGraphicsProject = typeof motionGraphicsProjectsTable.$inferInsert;
export type SelectMotionGraphicsProject = typeof motionGraphicsProjectsTable.$inferSelect;
