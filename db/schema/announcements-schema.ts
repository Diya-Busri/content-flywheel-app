import { pgTable, text, boolean, timestamp, uuid } from "drizzle-orm/pg-core";

export const announcementsTable = pgTable("announcements", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull().default("info"), // info | warning | success | promo
  active: boolean("active").notNull().default(true),
  targetAll: boolean("target_all").notNull().default(true),
  linkUrl: text("link_url"),
  linkLabel: text("link_label"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type InsertAnnouncement = typeof announcementsTable.$inferInsert;
export type SelectAnnouncement = typeof announcementsTable.$inferSelect;
