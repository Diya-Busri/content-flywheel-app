import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

/**
 * Brand campaigns: content items (video or carousel) linked to a brand workspace.
 * content_type: video | carousel
 * status: draft | ready | posted
 */
export const brandCampaignsTable = pgTable("brand_campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  workspaceId: uuid("workspace_id").notNull(),
  contentType: text("content_type").notNull(), // video | carousel
  postConcept: text("post_concept"),
  scriptJson: jsonb("script_json"),
  voiceoverText: text("voiceover_text"),
  timelineJson: jsonb("timeline_json"),
  carouselJson: jsonb("carousel_json"),
  caption: text("caption"),
  hashtags: text("hashtags"),
  title: text("title"),
  description: text("description"),
  scheduledDate: timestamp("scheduled_date"),
  status: text("status").notNull(), // draft | ready | posted
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertBrandCampaign = typeof brandCampaignsTable.$inferInsert;
export type SelectBrandCampaign = typeof brandCampaignsTable.$inferSelect;
