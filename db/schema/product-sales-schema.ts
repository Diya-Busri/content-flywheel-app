import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";

/**
 * Product sales log: manual entries per product per platform.
 * Users log each sale — amount in cents to avoid float issues.
 */
export const productSalesTable = pgTable("product_sales", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  productId: uuid("product_id").notNull(),
  platform: text("platform").notNull(), // gumroad | etsy | stan-store | beacons | payhip | other
  amountCents: integer("amount_cents").notNull(), // e.g. 1999 = $19.99
  currency: text("currency").notNull().default("USD"),
  note: text("note"), // optional note
  soldAt: timestamp("sold_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type InsertProductSale = typeof productSalesTable.$inferInsert;
export type SelectProductSale = typeof productSalesTable.$inferSelect;
