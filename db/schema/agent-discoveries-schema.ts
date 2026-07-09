import { pgTable, uuid, text, real, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const agentDiscoveriesTable = pgTable("agent_discoveries", {
  id:            uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId:        text("user_id").notNull(),
  agentType:     text("agent_type").notNull(),
  discoveryType: text("discovery_type").notNull(),
  title:         text("title").notNull(),
  description:   text("description"),
  confidence:    real("confidence").notNull().default(0.7),
  priority:      integer("priority").notNull().default(5),
  isDismissed:   boolean("is_dismissed").notNull().default(false),
  actionType:    text("action_type"),
  actionLabel:   text("action_label"),
  actionUrl:     text("action_url"),
  metadata:      jsonb("metadata").notNull().default({}),
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
