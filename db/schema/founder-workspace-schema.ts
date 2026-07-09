import { pgTable, text, timestamp, uuid, jsonb, integer, real } from "drizzle-orm/pg-core";

/**
 * Founder OS — admin-only workspace entries (Knowledge Engine).
 *
 * Category covers all sections: research | marketing-psychology | copywriting |
 * content-ideas | analytics | distribution | experiments
 *
 * Knowledge Engine fields:
 * - tags:              searchable labels (auto-extracted + manually added)
 * - aiSummary:        1–2 sentence AI-generated summary for quick scanning
 * - relatedEntryIds:  IDs of related Founder OS entries (knowledge graph edges)
 * - usageCount:       how many times this entry has been surfaced to an AI feature
 * - source:           'manual' | 'research' | 'coach' | 'analytics' | 'experiment'
 * - confidenceScore:  0.0–1.0 — how confident the platform is in this insight
 * - lastUsedAt:       last time an AI feature referenced this entry
 *
 * NOTE: the `embedding vector(1536)` column exists in Postgres but is managed
 * via raw SQL (pgvector). It is intentionally absent from this Drizzle schema
 * because drizzle-orm 0.33 does not support the pgvector column type natively.
 */
export const founderWorkspaceEntriesTable = pgTable("founder_workspace_entries", {
  id:               uuid("id").primaryKey().defaultRandom(),
  userId:           text("user_id").notNull(),
  category:         text("category").notNull(),
  type:             text("type").notNull(),
  title:            text("title").notNull(),
  content:          text("content").notNull().default(""),
  metadata:         jsonb("metadata"),

  // ── Knowledge Engine columns ──────────────────────────────────────────
  // tags and relatedEntryIds are text[] in Postgres — stored as JSON here
  // because Drizzle 0.33 array support requires additional setup; use
  // the raw client for array operations and raw SQL for vector ops.
  aiSummary:        text("ai_summary"),
  usageCount:       integer("usage_count").default(0).notNull(),
  source:           text("source").default("manual").notNull(),
  confidenceScore:  real("confidence_score").default(1.0).notNull(),
  lastUsedAt:       timestamp("last_used_at", { withTimezone: true }),

  createdAt:        timestamp("created_at").defaultNow().notNull(),
  updatedAt:        timestamp("updated_at").defaultNow().notNull(),
});

export type InsertFounderWorkspaceEntry = typeof founderWorkspaceEntriesTable.$inferInsert;
export type SelectFounderWorkspaceEntry = typeof founderWorkspaceEntriesTable.$inferSelect;

/**
 * Full knowledge entry type — extends SelectFounderWorkspaceEntry with
 * array columns that are handled outside Drizzle's type system.
 */
export type FounderKnowledgeEntry = SelectFounderWorkspaceEntry & {
  tags?: string[];
  relatedEntryIds?: string[];
  /** Cosine similarity score (0–1), populated by search results only */
  relevance?: number;
};
