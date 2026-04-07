import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const featureFlagsTable = pgTable("feature_flags", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull(),
  label: text("label").notNull(),
  description: text("description"),
  enabled: boolean("enabled").notNull().default(false),
  /** null = global (all users), set userId = per-user override */
  userId: text("user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
