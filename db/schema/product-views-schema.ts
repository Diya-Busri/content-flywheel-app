import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const productViewsTable = pgTable("product_views", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").notNull(),
  viewedAt: timestamp("viewed_at").defaultNow().notNull(),
  referrer: text("referrer"),
  userAgent: text("user_agent"),
});

export type InsertProductView = typeof productViewsTable.$inferInsert;
export type SelectProductView = typeof productViewsTable.$inferSelect;
