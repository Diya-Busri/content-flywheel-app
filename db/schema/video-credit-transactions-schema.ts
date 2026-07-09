import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";

export const videoCreditTransactionsTable = pgTable("video_credit_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  /** "purchase" = credits added, "usage" = credits deducted */
  type: text("type").$type<"purchase" | "usage">().notNull(),
  /** Positive for purchases, positive for usage (represents credits spent) */
  amount: integer("amount").notNull(),
  description: text("description").notNull(),
  /**
   * Unique key that prevents duplicate credit grants.
   * Format: "clerk:signup:{userId}" | "stripe:invoice:{invoiceId}" | "stripe:session:{sessionId}"
   * A partial unique index in the DB (WHERE idempotency_key IS NOT NULL) enforces uniqueness
   * while allowing NULL for legacy rows and one-off manual grants.
   * See migration: add-video-credit-idempotency-key.sql
   */
  idempotencyKey: text("idempotency_key"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
