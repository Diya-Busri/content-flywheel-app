import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * AI Coach chat summaries for memory feature. One row per conversation summary.
 * user_id is Clerk user id.
 */
export const chatSummariesTable = pgTable("chat_summaries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  summary: text("summary").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertChatSummary = typeof chatSummariesTable.$inferInsert;
export type SelectChatSummary = typeof chatSummariesTable.$inferSelect;
