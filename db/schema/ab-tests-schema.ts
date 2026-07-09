import { pgTable, text, boolean, timestamp, uuid, jsonb, integer } from "drizzle-orm/pg-core";

export const abTestsTable = pgTable("ab_tests", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(), // e.g. "onboarding_v2"
  name: text("name").notNull(),
  description: text("description"),
  variants: jsonb("variants").notNull().default([]), // [{key: "control", label: "Control", weight: 50}, ...]
  active: boolean("active").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const abTestAssignmentsTable = pgTable("ab_test_assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  testKey: text("test_key").notNull(),
  userId: text("user_id").notNull(),
  variant: text("variant").notNull(),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
});

export type InsertAbTest = typeof abTestsTable.$inferInsert;
export type SelectAbTest = typeof abTestsTable.$inferSelect;
