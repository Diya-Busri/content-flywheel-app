import { pgTable, uuid, text, real, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const businessGoalsTable = pgTable("business_goals", {
  id:        uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId:    text("user_id").notNull(),
  goalType:  text("goal_type").notNull(),
  title:     text("title").notNull(),
  target:    real("target").notNull(),
  current:   real("current").notNull().default(0),
  unit:      text("unit").notNull().default(""),
  deadline:  timestamp("deadline", { withTimezone: true }),
  isActive:  boolean("is_active").notNull().default(true),
  metadata:  jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
