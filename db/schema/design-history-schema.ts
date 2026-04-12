import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

export const designHistoryTable = pgTable("design_history", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("user_id").notNull(),
  name: text("name").notNull().default("Untitled Design"),
  imageUrl: text("image_url").notNull(),
  sourceType: text("source_type").notNull().default("studio"), // "studio" | "upload" | "ai"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type InsertDesignHistory = typeof designHistoryTable.$inferInsert;
export type SelectDesignHistory = typeof designHistoryTable.$inferSelect;
