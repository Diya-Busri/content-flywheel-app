import { pgTable, uuid, text, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";

export const pageSessionsTable = pgTable("page_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  userId: text("user_id"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  lastPingAt: timestamp("last_ping_at").defaultNow().notNull(),
  durationSeconds: integer("duration_seconds").default(0).notNull(),
  pageViews: integer("page_views").default(1).notNull(),
  entryPage: text("entry_page"),
  pages: jsonb("pages").$type<string[]>().default([]),
  device: text("device"),
  browser: text("browser"),
  referrer: text("referrer"),
  isNew: boolean("is_new").default(true).notNull(),
});

export type InsertPageSession = typeof pageSessionsTable.$inferInsert;
export type SelectPageSession = typeof pageSessionsTable.$inferSelect;
