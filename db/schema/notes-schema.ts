/**
 * Notes — dedicated table for the Notes workspace feature.
 *
 * Migration SQL (run in Supabase SQL editor):
 * ──────────────────────────────────────────────────────────────────────────
 * CREATE TABLE IF NOT EXISTS notes (
 *   id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   user_id      TEXT NOT NULL,
 *   title        TEXT NOT NULL DEFAULT 'Untitled',
 *   content      JSONB,
 *   body         TEXT NOT NULL DEFAULT '',
 *   folder       TEXT,
 *   tags         JSONB DEFAULT '[]',
 *   is_pinned    BOOLEAN NOT NULL DEFAULT FALSE,
 *   is_archived  BOOLEAN NOT NULL DEFAULT FALSE,
 *   deleted_at   TIMESTAMPTZ,
 *   word_count   INTEGER NOT NULL DEFAULT 0,
 *   ai_summary   TEXT,
 *   created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *   updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
 * );
 *
 * CREATE INDEX IF NOT EXISTS notes_user_id_idx ON notes (user_id);
 * CREATE INDEX IF NOT EXISTS notes_user_updated_idx ON notes (user_id, updated_at DESC);
 * ──────────────────────────────────────────────────────────────────────────
 */

import { pgTable, text, timestamp, uuid, jsonb, boolean, integer } from "drizzle-orm/pg-core";

export const notesTable = pgTable("notes", {
  id:          uuid("id").primaryKey().defaultRandom(),
  userId:      text("user_id").notNull(),
  title:       text("title").notNull().default("Untitled"),
  /** TipTap JSON document */
  content:     jsonb("content").$type<Record<string, unknown>>(),
  /** Extracted plain text — for search and word count */
  body:        text("body").notNull().default(""),
  folder:      text("folder"),
  tags:        jsonb("tags").$type<string[]>().default([]),
  isPinned:    boolean("is_pinned").notNull().default(false),
  isArchived:  boolean("is_archived").notNull().default(false),
  deletedAt:   timestamp("deleted_at", { withTimezone: true }),
  wordCount:   integer("word_count").notNull().default(0),
  aiSummary:   text("ai_summary"),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type NoteRow    = typeof notesTable.$inferSelect;
export type NoteInsert = typeof notesTable.$inferInsert;
