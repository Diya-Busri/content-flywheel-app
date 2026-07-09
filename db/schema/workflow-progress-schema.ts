import { pgTable, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

export const workflowProgressTable = pgTable("workflow_progress", {
  userId: text("user_id").primaryKey().notNull(),
  workflowData: jsonb("workflow_data").$type<Record<string, unknown>>().notNull(),
  currentStep: integer("current_step").default(1).notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type InsertWorkflowProgress = typeof workflowProgressTable.$inferInsert;
export type SelectWorkflowProgress = typeof workflowProgressTable.$inferSelect;
