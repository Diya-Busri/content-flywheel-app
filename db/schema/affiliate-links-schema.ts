import { pgTable, text, timestamp, uuid, integer, boolean } from "drizzle-orm/pg-core";

export const affiliateLinksTable = pgTable("affiliate_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  creatorUserId: text("creator_user_id").notNull(),
  affiliateName: text("affiliate_name").notNull(),
  affiliateEmail: text("affiliate_email"),
  code: text("code").notNull(),
  commissionPercent: integer("commission_percent").notNull().default(20),
  totalEarnedCents: integer("total_earned_cents").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const affiliateCommissionsTable = pgTable("affiliate_commissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  affiliateLinkId: uuid("affiliate_link_id").notNull(),
  creatorUserId: text("creator_user_id").notNull(),
  orderSessionId: text("order_session_id").notNull(),
  productTitle: text("product_title"),
  amountCents: integer("amount_cents").notNull(),
  commissionCents: integer("commission_cents").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertAffiliateLink = typeof affiliateLinksTable.$inferInsert;
export type SelectAffiliateLink = typeof affiliateLinksTable.$inferSelect;
export type InsertAffiliateCommission = typeof affiliateCommissionsTable.$inferInsert;
export type SelectAffiliateCommission = typeof affiliateCommissionsTable.$inferSelect;
