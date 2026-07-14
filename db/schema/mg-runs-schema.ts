/**
 * Drizzle schema for mg_runs and mg_steps tables.
 * See db/migrations/add-mg-runs.sql for the SQL CREATE statements.
 */

import { pgTable, text, timestamp, uuid, jsonb, integer } from "drizzle-orm/pg-core";
import type { MgRunStatus, MgGate, MgPlan } from "@/lib/motion-graphics/agent-types";
import type { ShortFormOutput } from "@/lib/motion-graphics/types";

export const mgRunsTable = pgTable("mg_runs", {
  id:             uuid("id").defaultRandom().primaryKey(),
  userId:         text("user_id").notNull(),
  projectId:      uuid("project_id"),

  contentMode:    text("content_mode").notNull().default("reddit-reaction"),
  sourceText:     text("source_text").notNull().default(""),
  sourceUrl:      text("source_url"),
  targetAudience: text("target_audience"),
  mainOpinion:    text("main_opinion"),
  desiredCta:     text("desired_cta"),
  cfMention:      text("cf_mention").notNull().default("subtle"),
  videoDuration:  text("video_duration"),
  tone:           text("tone"),
  aspectRatio:    text("aspect_ratio").notNull().default("9:16"),

  status:         text("status").$type<MgRunStatus>().notNull().default("queued"),
  currentGate:    text("current_gate").$type<MgGate>(),

  plan:           jsonb("plan").$type<MgPlan>(),
  shortForm:      jsonb("short_form").$type<ShortFormOutput>(),
  error:          text("error"),

  createdAt:      timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const mgStepsTable = pgTable("mg_steps", {
  id:             uuid("id").defaultRandom().primaryKey(),
  runId:          uuid("run_id").notNull(),
  toolName:       text("tool_name").notNull(),
  attemptNumber:  integer("attempt_number").notNull().default(1),
  status:         text("status")
                    .$type<"queued" | "running" | "completed" | "failed" | "skipped">()
                    .notNull()
                    .default("queued"),
  input:          jsonb("input").$type<Record<string, unknown>>(),
  output:         jsonb("output").$type<Record<string, unknown>>(),
  error:          text("error"),
  startedAt:      timestamp("started_at",   { withTimezone: true }),
  completedAt:    timestamp("completed_at", { withTimezone: true }),
  createdAt:      timestamp("created_at",   { withTimezone: true }).defaultNow().notNull(),
});

export type InsertMgRun  = typeof mgRunsTable.$inferInsert;
export type SelectMgRun  = typeof mgRunsTable.$inferSelect;
export type InsertMgStep = typeof mgStepsTable.$inferInsert;
export type SelectMgStep = typeof mgStepsTable.$inferSelect;
