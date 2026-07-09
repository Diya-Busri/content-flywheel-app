import { pgTable, text, uuid, timestamp, jsonb } from "drizzle-orm/pg-core";

export const pushSubscriptionsTable = pgTable("push_subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertPushSubscription = typeof pushSubscriptionsTable.$inferInsert;
export type SelectPushSubscription = typeof pushSubscriptionsTable.$inferSelect;
