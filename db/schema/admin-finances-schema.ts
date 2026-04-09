import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";

export const adminExpensesTable = pgTable("admin_expenses", {
  id: uuid("id").defaultRandom().primaryKey(),
  amountPence: integer("amount_pence").notNull(), // stored in pence
  category: text("category").notNull().default("other"), // hosting, tools, subscriptions, marketing, design, tax, other
  description: text("description").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const adminFinanceNotesTable = pgTable("admin_finance_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type InsertAdminExpense = typeof adminExpensesTable.$inferInsert;
export type SelectAdminExpense = typeof adminExpensesTable.$inferSelect;
export type InsertAdminFinanceNote = typeof adminFinanceNotesTable.$inferInsert;
export type SelectAdminFinanceNote = typeof adminFinanceNotesTable.$inferSelect;
