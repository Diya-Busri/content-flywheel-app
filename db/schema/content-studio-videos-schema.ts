import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Content Studio video library (Clerk user_id). */
export const contentStudioVideosTable = pgTable("content_studio_videos", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  status: text("status").$type<"draft" | "ready" | "published">().default("draft").notNull(),
  videoType: text("video_type").$type<"youtube-long" | "youtube-short" | "tiktok">(),
  thumbnailUrl: text("thumbnail_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type InsertContentStudioVideo = typeof contentStudioVideosTable.$inferInsert;
export type SelectContentStudioVideo = typeof contentStudioVideosTable.$inferSelect;
