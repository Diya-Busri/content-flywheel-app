import { pgTable, uuid, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";

export const productOrdersTable = pgTable("product_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").notNull(),
  creatorUserId: text("creator_user_id").notNull(),
  buyerEmail: text("buyer_email").notNull(),
  buyerName: text("buyer_name"),
  buyerUserId: text("buyer_user_id"), // Clerk userId if the buyer was signed in; null for guest checkout
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("gbp"),
  stripeSessionId: text("stripe_session_id").notNull().unique(),
  stripePaymentIntentId: text("stripe_payment_intent_id"), // needed to issue a Stripe refund later
  status: text("status").notNull().default("pending"), // pending | completed | refunded
  downloadToken: text("download_token"),
  downloadExpiresAt: timestamp("download_expires_at"),
  emailSent: boolean("email_sent").default(false),
  reviewRequestSent: boolean("review_request_sent").default(false),

  // ── Pre-payment consent (required checkbox) ──────────────────────────────
  consentGiven: boolean("consent_given").default(false).notNull(),
  consentText: text("consent_text"), // exact checkbox copy shown at time of purchase
  consentPolicyVersion: text("consent_policy_version"), // see lib/refund-policy.ts
  consentTimestamp: timestamp("consent_timestamp"), // when the buyer submitted checkout with consent checked

  // ── Access + download tracking ────────────────────────────────────────────
  accessGrantedAt: timestamp("access_granted_at"), // when the download link/token was created
  firstDownloadAt: timestamp("first_download_at"), // first time the file was actually fetched

  // ── Refund / access revocation ────────────────────────────────────────────
  refundedAt: timestamp("refunded_at"),
  refundedBy: text("refunded_by"), // userId of the creator/admin who issued the refund
  refundReason: text("refund_reason"), // optional free-text note from the creator/admin
  accessRevokedAt: timestamp("access_revoked_at"), // download access blocked from this point on

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertProductOrder = typeof productOrdersTable.$inferInsert;
export type SelectProductOrder = typeof productOrdersTable.$inferSelect;
