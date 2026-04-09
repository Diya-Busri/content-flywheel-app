import { pgTable, text, timestamp, uuid, integer, boolean } from "drizzle-orm/pg-core";

export const productBundlesTable = pgTable("product_bundles", {
  id: uuid("id").defaultRandom().primaryKey(),
  creatorUserId: text("creator_user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  bundlePrice: integer("bundle_price").notNull(), // in pence
  productIds: text("product_ids").array().notNull().default([]),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type InsertProductBundle = typeof productBundlesTable.$inferInsert;
export type SelectProductBundle = typeof productBundlesTable.$inferSelect;
