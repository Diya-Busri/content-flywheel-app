import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";

export const scheduledBlastsTable = pgTable("scheduled_blasts", {
  id: uuid("id").defaultRandom().primaryKey(),
  subject: text("subject").notNull(),
  htmlBody: text("html_body").notNull(),
  audience: text("audience").notNull(), // "all" | "active_7d" | "active_30d" | "inactive_30d" | "specific"
  targetEmail: text("target_email"),    // only when audience = "specific"
  scheduledFor: timestamp("scheduled_for").notNull(),
  status: text("status").notNull().default("pending"), // "pending" | "sent" | "failed" | "cancelled"
  sentAt: timestamp("sent_at"),
  recipientCount: integer("recipient_count"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertScheduledBlast = typeof scheduledBlastsTable.$inferInsert;
export type SelectScheduledBlast = typeof scheduledBlastsTable.$inferSelect;
