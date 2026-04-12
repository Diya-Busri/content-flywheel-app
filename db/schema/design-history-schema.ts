import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const designHistoryTable = pgTable("design_history", {
  id: text("id").primaryKey().notNull().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  name: text("name").notNull().default("Untitled Design"),
  imageUrl: text("image_url").notNull(),
  sourceType: text("source_type").notNull().default("studio"), // "studio" | "upload" | "ai"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type InsertDesignHistory = typeof designHistoryTable.$inferInsert;
export type SelectDesignHistory = typeof designHistoryTable.$inferSelect;
