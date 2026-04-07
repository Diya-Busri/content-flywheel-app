import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";

export type ApplicationStatus = "pending" | "accepted" | "waitlisted" | "rejected";

export const creatorApplicationsTable = pgTable("creator_applications", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** Clerk userId of the person who invited them (nullable — direct visits have no referrer). */
  referrerUserId: text("referrer_user_id"),
  /** Applicant details — captured before they have a Clerk account. */
  name: text("name").notNull(),
  email: text("email").notNull(),
  /** Primary platform: tiktok | youtube | instagram | other */
  platform: text("platform").notNull(),
  /** Content niche e.g. "Finance & Investing", "3D Animation Comedy" */
  niche: text("niche").notNull(),
  /** Self-reported follower count on their primary platform. */
  followerCount: integer("follower_count").notNull(),
  /** Their main goal for using Content Flywheel. */
  goal: text("goal").notNull(),
  /** Auto-set on submission. ≥10 000 → accepted, else → waitlisted. Admin can override. */
  status: text("status").$type<ApplicationStatus>().default("pending").notNull(),
  /** Populated when the applicant actually creates a Clerk account. */
  clerkUserId: text("clerk_user_id"),
  /**
   * One-time invite token sent in the acceptance email.
   * Link: /sign-up?invite=TOKEN
   * Cleared after the applicant creates their account.
   */
  inviteToken: text("invite_token"),
  /** Optional note left by admin when manually reviewing. */
  reviewNote: text("review_note"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertCreatorApplication = typeof creatorApplicationsTable.$inferInsert;
export type SelectCreatorApplication = typeof creatorApplicationsTable.$inferSelect;
