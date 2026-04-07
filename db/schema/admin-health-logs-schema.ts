import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const adminHealthLogsTable = pgTable("admin_health_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  level: text("level").$type<"error" | "warning" | "info">().notNull().default("error"),
  route: text("route").notNull(),
  message: text("message").notNull(),
  userId: text("user_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
