import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

export type YouTubeChannel = {
  id: string;
  name: string;
  subscriber_count: number;
};

/** Content Studio: user content settings (niche, content style, YouTube channels). Clerk user_id. */
export const userContentSettingsTable = pgTable("user_content_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().unique(),
  selectedNiche: text("selected_niche"),
  contentStyle: text("content_style").$type<"faceless" | "ai-generated" | "personal-brand">(),
  youtubeChannels: jsonb("youtube_channels")
    .$type<YouTubeChannel[]>()
    .default([])
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type InsertUserContentSettings = typeof userContentSettingsTable.$inferInsert;
export type SelectUserContentSettings = typeof userContentSettingsTable.$inferSelect;
