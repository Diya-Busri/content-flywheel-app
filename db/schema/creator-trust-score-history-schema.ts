import { pgTable, text, timestamp, uuid, real, jsonb } from "drizzle-orm/pg-core";

/**
 * Trust Score history — one row per recalculation.
 * Used for the "score over time" chart on the creator dashboard.
 */
export const creatorTrustScoreHistoryTable = pgTable("creator_trust_score_history", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: text("user_id").notNull(),

  /** Score snapshot at this point in time. */
  score: real("score").notNull(),

  /** Level at this point in time. */
  level: text("level")
    .$type<"building" | "developing" | "trusted" | "excellent" | "elite">()
    .notNull(),

  /** Full breakdown snapshot. */
  breakdown: jsonb("breakdown").$type<Record<string, number>>().notNull().default({}),

  /** What triggered this recalculation. */
  trigger: text("trigger").notNull().default("manual"),

  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
});

export type InsertCreatorTrustScoreHistory = typeof creatorTrustScoreHistoryTable.$inferInsert;
export type SelectCreatorTrustScoreHistory = typeof creatorTrustScoreHistoryTable.$inferSelect;
