import { pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";

export const emailAutomationsTable = pgTable("email_automations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(), // "welcome" | future: "post_purchase" | "re_engagement"
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type InsertEmailAutomation = typeof emailAutomationsTable.$inferInsert;
export type SelectEmailAutomation = typeof emailAutomationsTable.$inferSelect;
