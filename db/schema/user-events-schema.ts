import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const userEventsTable = pgTable("user_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  event: text("event").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
