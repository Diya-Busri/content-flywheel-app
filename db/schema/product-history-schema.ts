import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

/**
 * History of generated products. One row per successful generation.
 * product_id links to the product so "Open" can load it in the editor.
 */
export const productHistoryTable = pgTable("product_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  productId: uuid("product_id"), // link to products.id for "Open"
  productTitle: text("product_title").notNull(),
  formatType: text("format_type").notNull(),
  contentJson: jsonb("content_json").$type<Record<string, unknown>>().notNull(),
  status: text("status").notNull(), // draft | complete
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertProductHistory = typeof productHistoryTable.$inferInsert;
export type SelectProductHistory = typeof productHistoryTable.$inferSelect;
