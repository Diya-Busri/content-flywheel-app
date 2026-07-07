import {
  pgTable,
  uuid,
  text,
  jsonb,
  real,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

// NOTE: the `embedding vector(1536)` column is managed via raw SQL only.
// Drizzle 0.33 does not support pgvector — use client.unsafe() for all vector ops.

export const userMemoryTable = pgTable("user_memory", {
  id:              uuid("id").primaryKey().defaultRandom(),
  userId:          text("user_id").notNull(),
  category:        text("category").notNull(),
  type:            text("type").notNull(),
  title:           text("title").notNull(),
  content:         text("content").notNull().default(""),
  metadata:        jsonb("metadata"),
  aiSummary:       text("ai_summary"),
  // tags array — Drizzle doesn't have a clean text[] helper; use raw sql cast on read
  memoryType:      text("memory_type").notNull().default("automatic"),
  source:          text("source").notNull().default("manual"),
  confidenceScore:  real("confidence_score").default(1.0).notNull(),
  usageCount:       integer("usage_count").default(0).notNull(),
  importanceScore:  real("importance_score").default(0.5).notNull(),
  performanceScore: real("performance_score").default(0.5).notNull(),
  combinedScore:    real("combined_score").default(0.5).notNull(),
  lastUsedAt:       timestamp("last_used_at", { withTimezone: true }),
  createdAt:        timestamp("created_at").defaultNow().notNull(),
  updatedAt:        timestamp("updated_at").defaultNow().notNull(),
});

export type InsertUserMemory = typeof userMemoryTable.$inferInsert;
export type SelectUserMemory = typeof userMemoryTable.$inferSelect;
