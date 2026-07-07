import { pgTable, uuid, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const agentTasksTable = pgTable("agent_tasks", {
  id:          uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId:      text("user_id").notNull(),
  agentType:   text("agent_type").notNull(),
  title:       text("title").notNull(),
  description: text("description"),
  status:      text("status").notNull().default("pending"),
  priority:    integer("priority").notNull().default(5),
  dueDate:     timestamp("due_date", { withTimezone: true }),
  metadata:    jsonb("metadata").notNull().default({}),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
