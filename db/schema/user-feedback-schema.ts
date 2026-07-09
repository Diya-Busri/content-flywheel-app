import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";

export const userFeedbackTable = pgTable("user_feedback", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  rating: integer("rating"), // 1-5, optional
  category: text("category").$type<"bug" | "idea" | "praise" | "other">().notNull().default("other"),
  message: text("message").notNull(),
  page: text("page"), // which page they were on
  status: text("status").$type<"new" | "reviewed" | "actioned">().notNull().default("new"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
