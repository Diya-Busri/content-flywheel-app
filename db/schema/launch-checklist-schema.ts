import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

export type LaunchChecklistPhase = {
  phase?: string;
  tasks?: string[];
  estimated_time?: string;
};

export type LaunchChecklistWaitlistEmail = {
  subject?: string;
  body?: string;
};

export type LaunchChecklistFirstDropPricing = {
  suggested_products?: string[];
  pricing_notes?: string;
};

/**
 * Brand Builder Launch Checklist: one row per user (upsert by user_id).
 * Stores full roadmap + completed_tasks (array of keys e.g. "0.0", "1.2").
 */
export const launchChecklistTable = pgTable("launch_checklist", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().unique(),
  brandName: text("brand_name"),
  followerCount: text("follower_count"),
  podPlatform: text("pod_platform"),
  sellingPlatform: text("selling_platform"),
  stage: text("stage"),
  milestoneToLaunch: text("milestone_to_launch"),
  checklist: jsonb("checklist").$type<LaunchChecklistPhase[]>(),
  completedTasks: jsonb("completed_tasks").$type<string[]>(),
  waitlistEmail: jsonb("waitlist_email").$type<LaunchChecklistWaitlistEmail>(),
  firstDropPricing: jsonb("first_drop_pricing").$type<LaunchChecklistFirstDropPricing>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type InsertLaunchChecklist = typeof launchChecklistTable.$inferInsert;
export type SelectLaunchChecklist = typeof launchChecklistTable.$inferSelect;
