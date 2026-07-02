import { pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";

/**
 * Tracks featured product placements in the marketplace.
 * Creators can feature one product per niche slot.
 * Featured products appear pinned at the top of their niche filter results.
 */
export const featuredProductsTable = pgTable("featured_products", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: text("product_id").notNull().unique(), // one slot per product
  userId: text("user_id").notNull(),
  niche: text("niche").notNull(),
  active: boolean("active").notNull().default(true),
  featuredUntil: timestamp("featured_until"), // null = indefinite (earned via referrals)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type InsertFeaturedProduct = typeof featuredProductsTable.$inferInsert;
export type SelectFeaturedProduct = typeof featuredProductsTable.$inferSelect;
