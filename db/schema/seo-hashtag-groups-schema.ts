import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Saved hashtag groups for SEO tool. User can save platform-specific hashtag sets for reuse.
 */
export const seoHashtagGroupsTable = pgTable("seo_hashtag_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  platform: text("platform").notNull(), // "youtube" | "tiktok" | "instagram"
  topic: text("topic"), // optional topic label
  tags: text("tags").notNull(), // JSON array of strings, e.g. ["#tag1","#tag2"]
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertSeoHashtagGroup = typeof seoHashtagGroupsTable.$inferInsert;
export type SelectSeoHashtagGroup = typeof seoHashtagGroupsTable.$inferSelect;
