import { pgTable, text, timestamp, uuid, integer, boolean } from "drizzle-orm/pg-core";

/**
 * Tracks async bundle generation jobs so progress persists across page refreshes
 * and email/notification can fire when all products complete.
 * The `id` is the same UUID used as `bundleId` on the products table.
 */
export const bundleJobsTable = pgTable("bundle_jobs", {
  id: uuid("id").primaryKey(),
  userId: text("user_id").notNull(),
  niche: text("niche").notNull(),
  /** 'generating' | 'completed' | 'partial' | 'failed' */
  status: text("status").notNull().default("generating"),
  totalCount: integer("total_count").notNull().default(8),
  completedCount: integer("completed_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  emailSent: boolean("email_sent").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export type InsertBundleJob = typeof bundleJobsTable.$inferInsert;
export type SelectBundleJob = typeof bundleJobsTable.$inferSelect;
