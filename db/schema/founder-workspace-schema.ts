import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

/**
 * Founder OS — admin-only workspace entries.
 * A single table covers all 7 sections via the `category` field.
 * `type` is a sub-type within the category (e.g. "insight" vs "framework" inside Research).
 * `metadata` is an open jsonb column for category-specific fields.
 */
export const founderWorkspaceEntriesTable = pgTable("founder_workspace_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  category: text("category").notNull(), // research | marketing-psychology | copywriting | content-ideas | analytics | distribution | experiments
  type: text("type").notNull(),         // sub-type within category
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  metadata: jsonb("metadata"),          // category-specific structured fields
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type InsertFounderWorkspaceEntry = typeof founderWorkspaceEntriesTable.$inferInsert;
export type SelectFounderWorkspaceEntry = typeof founderWorkspaceEntriesTable.$inferSelect;
