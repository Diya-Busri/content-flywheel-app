import { pgTable, uuid, text, real, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const userRecommendationsTable = pgTable("user_recommendations", {
  id:           uuid("id").primaryKey().defaultRandom(),
  userId:       text("user_id").notNull(),
  recType:      text("rec_type").notNull(),     // action|insight|opportunity|warning
  title:        text("title").notNull(),
  description:  text("description").notNull(),
  confidence:   real("confidence").default(0.7).notNull(),
  priority:     integer("priority").default(5).notNull(),
  actionType:   text("action_type"),            // create-product|run-research|create-experiment|null
  isDismissed:  boolean("is_dismissed").default(false).notNull(),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type InsertUserRecommendation = typeof userRecommendationsTable.$inferInsert;
export type SelectUserRecommendation = typeof userRecommendationsTable.$inferSelect;
