import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

export const captionLibraryTable = pgTable("caption_library", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("user_id").notNull(),
  title: text("title").notNull().default(""),
  caption: text("caption").notNull(),
  hashtags: text("hashtags").notNull().default(""),
  platform: text("platform").notNull().default("all"), // "all" | "tiktok" | "instagram" | "youtube"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type InsertCaptionLibrary = typeof captionLibraryTable.$inferInsert;
export type SelectCaptionLibrary = typeof captionLibraryTable.$inferSelect;
