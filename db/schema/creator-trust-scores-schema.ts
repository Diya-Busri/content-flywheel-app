import { pgTable, text, timestamp, uuid, real, boolean, jsonb } from "drizzle-orm/pg-core";

/**
 * Creator Trust Score — buyer-facing reputation signal.
 * Separate from creator_scores (gamification). This is about TRUST, not points.
 * Score is 0–100, recalculated automatically on key events.
 */
export const creatorTrustScoresTable = pgTable("creator_trust_scores", {
  id: uuid("id").defaultRandom().primaryKey(),

  /** Clerk user ID — one row per creator (upserted on recalculation). */
  userId: text("user_id").notNull().unique(),

  /** Composite Trust Score 0–100. */
  totalScore: real("total_score").notNull().default(0),

  /**
   * Level label derived from totalScore.
   * "building" | "developing" | "trusted" | "excellent" | "elite"
   */
  level: text("level")
    .$type<"building" | "developing" | "trusted" | "excellent" | "elite">()
    .notNull()
    .default("building"),

  /**
   * Breakdown JSONB — scores per factor (0–100 each).
   * Shape: { verifiedSales: number, avgRating: number, reviewCount: number,
   *   refundRate: number, productCompleteness: number, profileCompleteness: number,
   *   followerGrowth: number, accountAge: number, communityScore: number, responseTime: number }
   */
  breakdown: jsonb("breakdown").$type<Record<string, number>>().notNull().default({}),

  /**
   * AI-generated recommended actions (JSON array of strings).
   * Regenerated each time the score is recomputed.
   */
  recommendations: jsonb("recommendations").$type<string[]>().notNull().default([]),

  /**
   * Raw signal values used in the last calculation (for admin inspect + UI display).
   */
  rawSignals: jsonb("raw_signals").$type<Record<string, number>>().notNull().default({}),

  /** Whether this creator allows their Trust Score to be visible publicly. */
  publicOptIn: boolean("public_opt_in").notNull().default(false),

  /** Admin can suppress a score even if creator opted in (e.g. suspicious activity). */
  adminSuppressed: boolean("admin_suppressed").notNull().default(false),

  /** Admin override — if set, this value is shown instead of the computed score. */
  adminOverrideScore: real("admin_override_score"),

  /** When this score was last recalculated. */
  lastCalculatedAt: timestamp("last_calculated_at").defaultNow().notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type InsertCreatorTrustScore = typeof creatorTrustScoresTable.$inferInsert;
export type SelectCreatorTrustScore = typeof creatorTrustScoresTable.$inferSelect;
