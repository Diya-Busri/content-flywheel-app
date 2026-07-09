import { pgTable, text, timestamp, uuid, real, jsonb } from "drizzle-orm/pg-core";

/**
 * Reputation events — immutable audit log of things that affected a creator's Trust Score.
 * Used in admin "reputation event history" view and creator "what changed" breakdown.
 */
export const creatorReputationEventsTable = pgTable("creator_reputation_events", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: text("user_id").notNull(),

  /**
   * Event type — what happened.
   * e.g. "sale_completed" | "sale_refunded" | "review_added" | "product_published"
   *    | "profile_updated" | "follower_gained" | "challenge_completed"
   *    | "admin_flag" | "admin_override" | "score_recalculated"
   */
  eventType: text("event_type").notNull(),

  /**
   * Score delta — how much this event is estimated to have changed the Trust Score.
   * Positive = improved, negative = reduced. Null if unknown / full recalculate.
   */
  scoreDelta: real("score_delta"),

  /** Human-readable description of the event. */
  description: text("description").notNull(),

  /** Extra metadata (e.g. productId, orderId, reviewId). */
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),

  /** Admin who triggered this event (if applicable). */
  adminUserId: text("admin_user_id"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertCreatorReputationEvent = typeof creatorReputationEventsTable.$inferInsert;
export type SelectCreatorReputationEvent = typeof creatorReputationEventsTable.$inferSelect;
