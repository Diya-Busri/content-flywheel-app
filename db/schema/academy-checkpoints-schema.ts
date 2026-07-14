import { pgTable, text, boolean, integer, timestamp, uuid, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { academyLessonsTable, academyCoursesTable } from "@/db/schema/academy-schema";

/**
 * Academy "Understanding Check" — end-of-lesson checkpoint.
 *
 * One row per (user, lesson). Tracks checkpoint UI state and understanding
 * confirmation SEPARATELY from `academy_progress` (lesson completion) —
 * a user can complete a lesson, ask for help, and confirm understanding
 * later, or never at all, without affecting their completion record.
 */
export const academyLessonCheckpointsTable = pgTable(
  "academy_lesson_checkpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    lessonId: uuid("lesson_id").notNull().references(() => academyLessonsTable.id, { onDelete: "cascade" }),
    courseId: uuid("course_id").notNull().references(() => academyCoursesTable.id, { onDelete: "cascade" }),

    // 'not_opened' | 'opened' | 'skipped' | 'understood'
    status: text("status").default("not_opened").notNull(),

    // Kept separate from lesson completion (academy_progress table).
    understandingConfirmed: boolean("understanding_confirmed").default(false).notNull(),
    understandingConfirmedAt: timestamp("understanding_confirmed_at"),

    // Last quick-action selected: 'explain_simpler' | 'example' | 'question' | 'apply' | null
    lastHelpOption: text("last_help_option"),

    // Set once per completed-lesson session so we don't repeatedly force the
    // panel open on every visit after the user has skipped it.
    skippedAt: timestamp("skipped_at"),

    // Generated output from "Help me apply this" (structured — see lib/academy-checkpoint-routing.ts).
    applicationOutput: jsonb("application_output"),
    applicationOutputSavedAt: timestamp("application_output_saved_at"),

    // Set once we've auto-tagged a "needed extra help" note into Business Brain
    // (see confirmUnderstandingAction) — prevents duplicate memory entries if
    // understanding gets confirmed more than once.
    struggleMemorySavedAt: timestamp("struggle_memory_saved_at"),

    openedAt: timestamp("opened_at"),
    lastInteractionAt: timestamp("last_interaction_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => ({
    userLessonUnique: uniqueIndex("academy_lesson_checkpoints_user_lesson_unique").on(table.userId, table.lessonId),
    lessonIdx: index("academy_lesson_checkpoints_lesson_idx").on(table.lessonId),
    userIdx: index("academy_lesson_checkpoints_user_idx").on(table.userId),
  })
);

/**
 * Conversation transcript for a checkpoint. Quick-action clicks are stored as
 * a synthetic user message (e.g. "Show me an example") so history reads as
 * one natural thread when the user reopens the lesson.
 */
export const academyCheckpointMessagesTable = pgTable(
  "academy_checkpoint_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    checkpointId: uuid("checkpoint_id").notNull().references(() => academyLessonCheckpointsTable.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // 'user' | 'assistant'
    content: text("content").notNull(),
    helpOption: text("help_option"), // which quick action this turn belongs to, if any
    // Opt-in generated visual (see hooks/useAcademyCheckpointChat.ts generateVisual) —
    // null until the learner explicitly clicks "Add a visual"; never generated automatically.
    imageUrl: text("image_url"),
    // Monotonic sequence for deterministic ordering even when createdAt collides at ms resolution.
    seq: integer("seq").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    checkpointIdx: index("academy_checkpoint_messages_checkpoint_idx").on(table.checkpointId),
    checkpointSeqIdx: index("academy_checkpoint_messages_checkpoint_seq_idx").on(table.checkpointId, table.seq),
  })
);

export type InsertAcademyLessonCheckpoint = typeof academyLessonCheckpointsTable.$inferInsert;
export type SelectAcademyLessonCheckpoint = typeof academyLessonCheckpointsTable.$inferSelect;
export type InsertAcademyCheckpointMessage = typeof academyCheckpointMessagesTable.$inferInsert;
export type SelectAcademyCheckpointMessage = typeof academyCheckpointMessagesTable.$inferSelect;

export const CHECKPOINT_HELP_OPTIONS = ["explain_simpler", "example", "question", "apply"] as const;
export type CheckpointHelpOption = (typeof CHECKPOINT_HELP_OPTIONS)[number];

export const CHECKPOINT_STATUSES = ["not_opened", "opened", "skipped", "understood"] as const;
export type CheckpointStatus = (typeof CHECKPOINT_STATUSES)[number];
