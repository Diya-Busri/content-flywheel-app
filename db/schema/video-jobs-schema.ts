import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export type VideoJobStatus = "pending" | "processing" | "completed" | "failed";

/** UGC Lab video jobs — one per script variation, polled individually. Regeneration creates new jobs. */
export const videoJobsTable = pgTable("video_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  campaignId: text("campaign_id"), // links to ugc_campaigns when in campaign context
  batchId: text("batch_id").notNull(), // groups jobs from same Generate click
  parentJobId: text("parent_job_id"), // when regenerated from another job
  status: text("status").$type<VideoJobStatus>().notNull().default("pending"),
  angleType: text("angle_type"), // marketing angle (pain_focused, etc.)
  scriptId: text("script_id"), // unique id for this script version
  templateId: text("template_id"),
  formatId: text("format_id"), // ranking format: countdown, scoreboard, tier_list, vs_battle
  faceProfileId: text("face_profile_id"),
  provider: text("provider"), // 'heygen' | 'faceswap' - which render provider to use
  externalJobId: text("external_job_id"), // provider's job ID for polling
  hookPreview: text("hook_preview").notNull(),
  fullScript: text("full_script").notNull(),
  videoUrl: text("video_url"),
  error: text("error"),
  progress: text("progress"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
