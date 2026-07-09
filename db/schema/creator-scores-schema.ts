import { pgTable, text, timestamp, uuid, real, integer, boolean } from "drizzle-orm/pg-core";

/**
 * Creator Reputation Score — cached, recomputed periodically.
 * Score is out of 100 based on multiple signals.
 */
export const creatorScoresTable = pgTable("creator_scores", {
  id: uuid("id").defaultRandom().primaryKey(),

  /** Clerk user ID. One row per creator (upserted on recalculation). */
  userId: text("user_id").notNull().unique(),

  /** Composite reputation score 0–100. */
  score: real("score").notNull().default(0),

  /** Raw signals used in calculation. */
  salesCount:        integer("sales_count").notNull().default(0),
  avgRating:         real("avg_rating").notNull().default(0),
  reviewCount:       integer("review_count").notNull().default(0),
  revenueGbp:        real("revenue_gbp").notNull().default(0),
  followerCount:     integer("follower_count").notNull().default(0),
  productCount:      integer("product_count").notNull().default(0),
  /** 0–10 quality score based on completeness (cover, description, price, etc.) */
  productQuality:    real("product_quality").notNull().default(0),

  /** Creator level derived from salesCount. */
  level: text("level").$type<"new" | "rising" | "pro" | "elite">().notNull().default("new"),

  /** Whether the creator has opted in to showing their score publicly. */
  publicOptIn: boolean("public_opt_in").notNull().default(false),

  /** Whether the creator has opted into leaderboard. */
  leaderboardOptIn: boolean("leaderboard_opt_in").notNull().default(false),

  /** When this score was last recalculated. */
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type InsertCreatorScore = typeof creatorScoresTable.$inferInsert;
export type SelectCreatorScore = typeof creatorScoresTable.$inferSelect;
