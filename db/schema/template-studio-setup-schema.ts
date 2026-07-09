import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

/**
 * Template Studio setup: saved mode + inputs so user can return and regenerate.
 * One row per user (upsert by user_id). inputs is mode-specific (niche, templateType, brandName, etc.).
 */
export const templateStudioSetupTable = pgTable("template_studio_setup", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().unique(),
  mode: text("mode").notNull(), // "1" | "2" | "3"
  inputs: jsonb("inputs").$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type InsertTemplateStudioSetup = typeof templateStudioSetupTable.$inferInsert;
export type SelectTemplateStudioSetup = typeof templateStudioSetupTable.$inferSelect;
