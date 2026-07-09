import { pgTable, uuid, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const emailSequencesTable = pgTable("email_sequences", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const emailSequenceStepsTable = pgTable("email_sequence_steps", {
  id: uuid("id").defaultRandom().primaryKey(),
  sequenceId: uuid("sequence_id").notNull(),
  stepNumber: integer("step_number").notNull(),
  delayDays: integer("delay_days").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertEmailSequence = typeof emailSequencesTable.$inferInsert;
export type SelectEmailSequence = typeof emailSequencesTable.$inferSelect;
export type InsertEmailSequenceStep = typeof emailSequenceStepsTable.$inferInsert;
export type SelectEmailSequenceStep = typeof emailSequenceStepsTable.$inferSelect;
