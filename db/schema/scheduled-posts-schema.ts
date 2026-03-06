import { pgTable, text, timestamp, uuid, jsonb, boolean } from "drizzle-orm/pg-core";

/**
 * Scheduled posts: content queued for a specific date/time and platform.
 * When scheduled_time is reached, show "time to post" (manual upload for now).
 * posted_status: false = queued, true = user marked as posted.
 */
export const scheduledPostsTable = pgTable("scheduled_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  contentType: text("content_type").notNull(), // e.g. video
  contentJson: jsonb("content_json").$type<Record<string, unknown>>().notNull(),
  platform: text("platform").notNull(), // tiktok | instagram | both
  scheduledTime: timestamp("scheduled_time", { withTimezone: true }).notNull(),
  postedStatus: boolean("posted_status").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type InsertScheduledPost = typeof scheduledPostsTable.$inferInsert;
export type SelectScheduledPost = typeof scheduledPostsTable.$inferSelect;
