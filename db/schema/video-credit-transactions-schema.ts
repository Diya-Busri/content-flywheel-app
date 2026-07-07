import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";

export const videoCreditTransactionsTable = pgTable("video_credit_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  /** "purchase" = credits added, "usage" = credits deducted */
  type: text("type").$type<"purchase" | "usage">().notNull(),
  /** Positive for purchases, positive for usage (represents credits spent) */
  amount: integer("amount").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
