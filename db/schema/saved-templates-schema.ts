import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * User-saved content templates (ebook, planner, copy, script, etc.).
 * user_id is Clerk user id. One row per template.
 */
export const savedTemplatesTable = pgTable("saved_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  formatType: text("format_type").notNull(), // ebook | planner | workbook | copy_writer | script | seo | marketing | other
  tags: text("tags"), // comma-separated
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertSavedTemplate = typeof savedTemplatesTable.$inferInsert;
export type SelectSavedTemplate = typeof savedTemplatesTable.$inferSelect;
