import { pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";

export const creatorWebhooksTable = pgTable("creator_webhooks", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  /** HTTPS URL to POST events to */
  url: text("url").notNull(),
  /** HMAC-SHA256 secret for verifying payloads */
  secret: text("secret").notNull(),
  /** Comma-separated list of subscribed events e.g. "product_sold,bundle_sold" */
  events: text("events").notNull().default("product_sold"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  /** Last delivery attempt result */
  lastStatus: text("last_status"),
  lastDeliveredAt: timestamp("last_delivered_at"),
});

export type InsertCreatorWebhook = typeof creatorWebhooksTable.$inferInsert;
export type SelectCreatorWebhook = typeof creatorWebhooksTable.$inferSelect;
