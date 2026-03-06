import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

/**
 * Brand Builder Drop Scripts: saved TikTok scripts by type (teaser, countdown, launch day, sold out).
 * user_id is Clerk user id.
 */
export const dropScriptsTable = pgTable("drop_scripts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  brandName: text("brand_name").notNull(),
  dropType: text("drop_type").notNull(), // first drop | restock | collab | limited edition
  vibe: text("vibe"),
  milestone: text("milestone"), // optional follower milestone
  scriptType: text("script_type").notNull(), // teaser | countdown | launch_day | sold_out_next_drop
  hook: text("hook").notNull(),
  middle: text("middle").notNull(),
  cta: text("cta").notNull(),
  textOverlays: jsonb("text_overlays").$type<string[]>(),
  suggestedAudio: text("suggested_audio"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertDropScript = typeof dropScriptsTable.$inferInsert;
export type SelectDropScript = typeof dropScriptsTable.$inferSelect;
