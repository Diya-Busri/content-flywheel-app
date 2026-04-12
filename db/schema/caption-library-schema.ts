import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const captionLibraryTable = pgTable("caption_library", {
  id: text("id").primaryKey().notNull().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  title: text("title").notNull().default(""),
  caption: text("caption").notNull(),
  hashtags: text("hashtags").notNull().default(""),
  platform: text("platform").notNull().default("all"), // "all" | "tiktok" | "instagram" | "youtube"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type InsertCaptionLibrary = typeof captionLibraryTable.$inferInsert;
export type SelectCaptionLibrary = typeof captionLibraryTable.$inferSelect;
