import { pgTable, uuid, text, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const orchestratorDecisionsTable = pgTable("orchestrator_decisions", {
  id:            uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId:        text("user_id").notNull(),
  title:         text("title").notNull(),
  description:   text("description"),
  reasoning:     text("reasoning"),
  priority:      integer("priority").notNull().default(5),
  goalAlignment: text("goal_alignment"),
  isActioned:    boolean("is_actioned").notNull().default(false),
  metadata:      jsonb("metadata").notNull().default({}),
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
