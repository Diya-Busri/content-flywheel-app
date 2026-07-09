import { pgTable, uuid, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const emailSequenceEnrollmentsTable = pgTable("email_sequence_enrollments", {
  id: uuid("id").defaultRandom().primaryKey(),
  sequenceId: uuid("sequence_id").notNull(),
  productId: text("product_id").notNull(),
  creatorUserId: text("creator_user_id").notNull(),
  buyerEmail: text("buyer_email").notNull(),
  enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
  /** UTC timestamp when the next step email should be sent */
  nextSendAt: timestamp("next_send_at").notNull(),
  /** stepNumber of the next step to send */
  nextStepNumber: integer("next_step_number").notNull(),
  completed: boolean("completed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertEmailSequenceEnrollment = typeof emailSequenceEnrollmentsTable.$inferInsert;
export type SelectEmailSequenceEnrollment = typeof emailSequenceEnrollmentsTable.$inferSelect;
