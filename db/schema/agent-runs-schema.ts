import { pgTable, uuid, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const agentRunsTable = pgTable("agent_runs", {
  id:               uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId:           text("user_id").notNull(),
  agentType:        text("agent_type").notNull(),
  status:           text("status").notNull().default("running"),
  discoveriesCount: integer("discoveries_count").notNull().default(0),
  tasksCount:       integer("tasks_count").notNull().default(0),
  reasoningLog:     jsonb("reasoning_log").notNull().default([]),
  startedAt:        timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt:      timestamp("completed_at", { withTimezone: true }),
});
