import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const agentPreferencesTable = pgTable("agent_preferences", {
  userId:    text("user_id").notNull(),
  agentType: text("agent_type").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
});
