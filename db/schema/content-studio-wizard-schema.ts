import { pgTable, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

/** Content Studio create wizard progress (Clerk user_id). */
export const contentStudioWizardProgressTable = pgTable("content_studio_wizard_progress", {
  userId: text("user_id").primaryKey().notNull(),
  currentStep: integer("current_step").default(1).notNull(),
  topics: text("topics"),
  goal: text("goal"),
  selectedNiche: text("selected_niche"),
  videoType: text("video_type"),
  contentStyle: text("content_style"),
  scriptStrategy: jsonb("script_strategy").$type<Record<string, unknown>>(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type InsertContentStudioWizardProgress = typeof contentStudioWizardProgressTable.$inferInsert;
export type SelectContentStudioWizardProgress = typeof contentStudioWizardProgressTable.$inferSelect;
