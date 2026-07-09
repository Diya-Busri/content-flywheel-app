import { pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";

/**
 * AI Coach settings per user: memory toggle, preferred names.
 * One row per user (upsert by user_id). user_id is Clerk user id.
 */
export const coachSettingsTable = pgTable("coach_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().unique(),
  memoryEnabled: boolean("memory_enabled").notNull().default(false),
  coachName: text("coach_name").notNull().default("Coach"),
  userName: text("user_name").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertCoachSettings = typeof coachSettingsTable.$inferInsert;
export type SelectCoachSettings = typeof coachSettingsTable.$inferSelect;

/**
 * AI Coach chat sessions: sidebar list with title, created_at, is_pinned.
 * Messages stay in client/localStorage; this table is for metadata and pin state.
 */
export const coachChatsTable = pgTable("coach_chats", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  isPinned: boolean("is_pinned").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertCoachChat = typeof coachChatsTable.$inferInsert;
export type SelectCoachChat = typeof coachChatsTable.$inferSelect;
