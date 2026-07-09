import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const userIntelligenceTimelineTable = pgTable("user_intelligence_timeline", {
  id:          uuid("id").primaryKey().defaultRandom(),
  userId:      text("user_id").notNull(),
  eventType:   text("event_type").notNull(),
  title:       text("title").notNull(),
  description: text("description"),
  memoryId:    uuid("memory_id"),
  patternId:   uuid("pattern_id"),
  metadata:    jsonb("metadata"),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type InsertIntelligenceTimeline = typeof userIntelligenceTimelineTable.$inferInsert;
export type SelectIntelligenceTimeline = typeof userIntelligenceTimelineTable.$inferSelect;
