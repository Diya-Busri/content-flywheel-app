import { pgTable, text, timestamp, uuid, integer, boolean } from "drizzle-orm/pg-core";

export const creatorPromoCodesTable = pgTable("creator_promo_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  creatorUserId: text("creator_user_id").notNull(),
  code: text("code").notNull(), // e.g. "SUMMER20"
  discountPercent: integer("discount_percent"), // e.g. 20 for 20% off (null if fixed amount)
  discountAmount: integer("discount_amount"),   // in pence (null if percent)
  maxUses: integer("max_uses"),                 // null = unlimited
  usedCount: integer("used_count").notNull().default(0),
  active: boolean("active").notNull().default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertCreatorPromoCode = typeof creatorPromoCodesTable.$inferInsert;
export type SelectCreatorPromoCode = typeof creatorPromoCodesTable.$inferSelect;
