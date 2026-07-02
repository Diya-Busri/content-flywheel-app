import { pgTable, uuid, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";

export const productOrdersTable = pgTable("product_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").notNull(),
  creatorUserId: text("creator_user_id").notNull(),
  buyerEmail: text("buyer_email").notNull(),
  buyerName: text("buyer_name"),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("gbp"),
  stripeSessionId: text("stripe_session_id").notNull().unique(),
  status: text("status").notNull().default("pending"), // pending | completed | refunded
  downloadToken: text("download_token"),
  downloadExpiresAt: timestamp("download_expires_at"),
  emailSent: boolean("email_sent").default(false),
  reviewRequestSent: boolean("review_request_sent").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertProductOrder = typeof productOrdersTable.$inferInsert;
export type SelectProductOrder = typeof productOrdersTable.$inferSelect;
