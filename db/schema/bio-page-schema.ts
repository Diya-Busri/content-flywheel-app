import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

export const bioPagesTable = pgTable("bio_pages", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("user_id").notNull().unique(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull().default(""),
  bio: text("bio").notNull().default(""),
  avatarUrl: text("avatar_url"),
  primaryColor: text("primary_color").notNull().default("#f97316"),
  links: text("links").notNull().default("[]"), // JSON: [{label, url}]
  showWaitlist: boolean("show_waitlist").notNull().default(true),
  waitlistCta: text("waitlist_cta").notNull().default("Be first to know when we drop"),
  isPublished: boolean("is_published").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const waitlistEntriesTable = pgTable("waitlist_entries", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("user_id").notNull(),
  email: text("email").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type InsertBioPage = typeof bioPagesTable.$inferInsert;
export type SelectBioPage = typeof bioPagesTable.$inferSelect;
export type InsertWaitlistEntry = typeof waitlistEntriesTable.$inferInsert;
export type SelectWaitlistEntry = typeof waitlistEntriesTable.$inferSelect;
