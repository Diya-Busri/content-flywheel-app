import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";

export type CampaignStatus = "draft" | "sent" | "scheduled";

export const emailContactsTable = pgTable("email_contacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  email: text("email").notNull(),
  name: text("name"),
  tags: text("tags").array().default([]).notNull(),
  subscribedAt: timestamp("subscribed_at").defaultNow().notNull(),
  unsubscribedAt: timestamp("unsubscribed_at"),
});

export const emailCampaignsTable = pgTable("email_campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  subject: text("subject").notNull(),
  previewText: text("preview_text"),
  bodyHtml: text("body_html").notNull(),
  status: text("status").$type<CampaignStatus>().default("draft").notNull(),
  sentAt: timestamp("sent_at"),
  scheduledFor: timestamp("scheduled_for"),
  recipientCount: integer("recipient_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertEmailContact = typeof emailContactsTable.$inferInsert;
export type SelectEmailContact = typeof emailContactsTable.$inferSelect;

export type InsertEmailCampaign = typeof emailCampaignsTable.$inferInsert;
export type SelectEmailCampaign = typeof emailCampaignsTable.$inferSelect;
