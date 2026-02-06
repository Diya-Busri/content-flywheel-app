import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

export const productsTable = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  niche: text("niche").notNull(),
  format: text("format").notNull(),
  content: jsonb("content").$type<{ sections: Array<{ id: string; title: string; content: string; order: number }> }>().notNull(),
  designSettings: jsonb("design_settings").$type<Record<string, unknown>>(),
  placedElements: jsonb("placed_elements").$type<unknown[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
