import { pgTable, uuid, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Tracks which users have wishlisted (saved ❤️) which marketplace products.
 * One row per (userId, productId) pair — enforced by unique index.
 */
export const productWishlistsTable = pgTable(
  "product_wishlists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Clerk user ID of the person who wishlisted the product. */
    userId: text("user_id").notNull(),
    /** UUID of the product being wishlisted. */
    productId: text("product_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueUserProduct: uniqueIndex("product_wishlists_user_product_idx").on(
      table.userId,
      table.productId
    ),
  })
);

export type InsertProductWishlist = typeof productWishlistsTable.$inferInsert;
export type SelectProductWishlist = typeof productWishlistsTable.$inferSelect;
