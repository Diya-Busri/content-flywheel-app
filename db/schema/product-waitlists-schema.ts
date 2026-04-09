import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const productWaitlistsTable = pgTable("product_waitlists", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: text("product_id").notNull(),
  creatorUserId: text("creator_user_id").notNull(),
  email: text("email").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertProductWaitlist = typeof productWaitlistsTable.$inferInsert;
export type SelectProductWaitlist = typeof productWaitlistsTable.$inferSelect;
