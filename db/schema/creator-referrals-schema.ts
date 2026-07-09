import { pgTable, text, timestamp, uuid, pgEnum } from "drizzle-orm/pg-core";

/**
 * Enhanced referral tracking — replaces the basic `referrals` table.
 * Credits are ONLY awarded when the referred user becomes a paying Pro subscriber.
 * Free trial sign-ups do NOT earn credits.
 */
export const referralStatusEnum = pgEnum("referral_status", [
  "pending_signup",    // Link clicked, not yet signed up
  "trial_active",      // Signed up, on free trial
  "product_published", // Published at least 1 product
  "pro_converted",     // Paid first invoice (trial → paid)
  "credit_awarded",    // Featured credit sent to referrer
  "expired",           // Cancelled before converting
  "rejected",          // Admin-rejected (abuse/duplicate)
]);

export const creatorReferralsTable = pgTable("creator_referrals", {
  id: uuid("id").defaultRandom().primaryKey(),

  /** Clerk user ID of the referrer (who sent the invite link). */
  referrerUserId: text("referrer_user_id").notNull(),

  /** Clerk user ID of the person who signed up. */
  referredUserId: text("referred_user_id").notNull().unique(),

  /** Email captured at sign-up (for display in referral list). */
  referredEmail: text("referred_email"),

  status: referralStatusEnum("status").notNull().default("pending_signup"),

  /** IP hash of referred user at sign-up — used for self-referral / duplicate detection. */
  ipHash: text("ip_hash"),

  /** When the referred user started their trial. */
  trialStartedAt: timestamp("trial_started_at"),

  /** When the referred user published their first product. */
  productPublishedAt: timestamp("product_published_at"),

  /** When the referred user made their first paid payment (trial → pro). */
  convertedAt: timestamp("converted_at"),

  /** When the referral credit was awarded to the referrer. */
  creditAwardedAt: timestamp("credit_awarded_at"),

  /** ID of the featured_credit_events row for this award (for audit trail). */
  creditEventId: text("credit_event_id"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type InsertCreatorReferral = typeof creatorReferralsTable.$inferInsert;
export type SelectCreatorReferral = typeof creatorReferralsTable.$inferSelect;
export type ReferralStatus = (typeof referralStatusEnum.enumValues)[number];
