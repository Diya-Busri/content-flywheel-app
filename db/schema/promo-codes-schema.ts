import { pgTable, text, boolean, timestamp, uuid, integer } from "drizzle-orm/pg-core";

export const promoCodesTable = pgTable("promo_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description"),
  discountPercent: integer("discount_percent").notNull().default(0),
  discountAmount: integer("discount_amount").notNull().default(0), // in cents
  maxUses: integer("max_uses"), // null = unlimited
  usedCount: integer("used_count").notNull().default(0),
  active: boolean("active").notNull().default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const promoCodeUsesTable = pgTable("promo_code_uses", {
  id: uuid("id").defaultRandom().primaryKey(),
  codeId: uuid("code_id").notNull().references(() => promoCodesTable.id),
  userId: text("user_id").notNull(),
  usedAt: timestamp("used_at").defaultNow().notNull(),
});

export type InsertPromoCode = typeof promoCodesTable.$inferInsert;
export type SelectPromoCode = typeof promoCodesTable.$inferSelect;
