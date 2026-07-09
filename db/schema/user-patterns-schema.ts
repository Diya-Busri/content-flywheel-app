import { pgTable, uuid, text, real, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";

export const userPatternsTable = pgTable("user_patterns", {
  id:               uuid("id").primaryKey().defaultRandom(),
  userId:           text("user_id").notNull(),
  patternType:      text("pattern_type").notNull(),
  title:            text("title").notNull(),
  description:      text("description").notNull(),
  confidence:       real("confidence").default(0.5).notNull(),
  occurrences:      integer("occurrences").default(1).notNull(),
  isActive:         boolean("is_active").default(true).notNull(),
  metadata:         jsonb("metadata"),
  firstDetectedAt:  timestamp("first_detected_at", { withTimezone: true }).defaultNow().notNull(),
  lastConfirmedAt:  timestamp("last_confirmed_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt:        timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type InsertUserPattern = typeof userPatternsTable.$inferInsert;
export type SelectUserPattern = typeof userPatternsTable.$inferSelect;
