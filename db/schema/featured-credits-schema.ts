import { pgTable, text, timestamp, uuid, real, pgEnum } from "drizzle-orm/pg-core";

/**
 * Featured Credit ledger — every earn and spend is a row.
 * Balance = SUM(amountCredits) for a userId.
 * Positive = earned, negative = spent.
 */
export const creditEventTypeEnum = pgEnum("credit_event_type", [
  "referral_conversion",  // +1.0 — referred user became a paying pro
  "sales_milestone",      // +1.0 — every 10 verified sales
  "revenue_milestone",    // +1.0 — every £100 verified revenue
  "product_of_week",      // +2.0 — admin-awarded weekly prize
  "review_milestone",     // +1.0 — every 25 five-star reviews
  "profile_complete",     // +0.25 — completed creator profile
  "challenge_complete",   // +0.5  — community challenge completion
  "manual_admin",         // any   — admin manual award/adjustment
  "feature_used",         // -1.0  — featured a product for 7 days
  "revoked",              // negative — admin revoked suspicious credits
]);

export const featuredCreditEventsTable = pgTable("featured_credit_events", {
  id: uuid("id").defaultRandom().primaryKey(),

  /** Clerk user ID who owns these credits. */
  userId: text("user_id").notNull(),

  type: creditEventTypeEnum("type").notNull(),

  /**
   * Credit amount.
   * Positive = earned, Negative = spent/revoked.
   * Examples: +1.0, +2.0, +0.25, -1.0
   */
  amountCredits: real("amount_credits").notNull(),

  /** Human-readable description shown in history. */
  description: text("description").notNull(),

  /**
   * Idempotency key — prevents double-granting.
   * Format examples:
   *   ref:converted:{referredUserId}
   *   sales:10:{userId}:{milestone}
   *   revenue:100:{userId}:{milestone}
   *   potw:{weekId}:{userId}
   *   reviews:25:{userId}:{milestone}
   *   profile:complete:{userId}
   *   feature:{productId}
   */
  idempotencyKey: text("idempotency_key").unique(),

  /** Related entity ID (productId, referralId, etc.) for linking. */
  relatedId: text("related_id"),

  /** Admin userId if this was a manual award or revocation. */
  adminUserId: text("admin_user_id"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertFeaturedCreditEvent = typeof featuredCreditEventsTable.$inferInsert;
export type SelectFeaturedCreditEvent = typeof featuredCreditEventsTable.$inferSelect;
export type CreditEventType = (typeof creditEventTypeEnum.enumValues)[number];
