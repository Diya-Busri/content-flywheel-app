import { pgTable, text, timestamp, uuid, integer, boolean, primaryKey } from "drizzle-orm/pg-core";

export type GoalStatus = "active" | "completed" | "paused" | "archived";

export type TaskCategory =
  | "admin"
  | "marketing"
  | "content_creation"
  | "operations"
  | "planning"
  | "analytics"
  | "follow_ups"
  | "product_dev"
  | "scheduling"
  | "maintenance";

export const goalsTable = pgTable("goals", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  targetDate: timestamp("target_date").notNull(),
  totalDays: integer("total_days").notNull(),
  /** Minutes per day the user committed to. */
  dailyTimeCommitment: integer("daily_time_commitment"),
  currentDay: integer("current_day").default(1).notNull(),
  status: text("status").$type<GoalStatus>().default("active").notNull(),
  streakCount: integer("streak_count").default(0).notNull(),
  longestStreak: integer("longest_streak").default(0).notNull(),
  /** When user last used their 1-per-week skip (null = never or new week). */
  lastSkippedAt: timestamp("last_skipped_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const dailyTasksTable = pgTable("daily_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  goalId: uuid("goal_id")
    .notNull()
    .references(() => goalsTable.id, { onDelete: "cascade" }),
  dayNumber: integer("day_number").notNull(),
  taskDescription: text("task_description").notNull(),
  /** Estimated duration in minutes. */
  estimatedDuration: integer("estimated_duration"),
  /** How / What / Where instructions. */
  howToComplete: text("how_to_complete"),
  isCompleted: boolean("is_completed").default(false).notNull(),
  /** Order within the day (0-based). */
  orderIndex: integer("order_index").default(0).notNull(),
  /** 'external' = general task; 'app_action' = in-app Content Flywheel feature. */
  taskType: text("task_type").$type<"external" | "app_action">().default("external").notNull(),
  /** For app_action: path e.g. /dashboard/products/create. */
  appLink: text("app_link"),
  /** For app_action: button label e.g. "Open Product Creator". */
  appLabel: text("app_label"),
  /** Task category for balance and grouping. */
  category: text("category").$type<TaskCategory>(),
  completedAt: timestamp("completed_at"),
  /** Whether proof is required before marking complete. */
  proofRequired: boolean("proof_required").default(true).notNull(),
  /** Type of proof: screenshot, text, link, file. */
  proofType: text("proof_type").$type<"screenshot" | "text" | "link" | "file">(),
  /** URL for screenshot/file upload or link proof. */
  proofUrl: text("proof_url"),
  /** Text description proof. */
  proofText: text("proof_text"),
  /** User's written explanation (required). */
  proofDescription: text("proof_description").notNull().default(""),
  /** When proof was submitted (server-set). */
  proofSubmittedAt: timestamp("proof_submitted_at"),
  /** validated | validation_skipped | null (legacy). */
  proofValidationStatus: text("proof_validation_status"),
  /** pending | validated | rejected | skipped */
  validationStatus: text("validation_status").$type<"pending" | "validated" | "rejected" | "skipped">(),
  /** AI's reasoning (nullable). */
  validationReason: text("validation_reason"),
  /** high | medium | low (nullable). */
  validationConfidence: text("validation_confidence").$type<"high" | "medium" | "low">(),
  /** Track failed validation attempts. */
  rejectionCount: integer("rejection_count").default(0).notNull(),
  /** When proof was validated (server-set). */
  validatedAt: timestamp("validated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** One row per goal per week when user confirmed "I was honest this week". week_start_date = Monday YYYY-MM-DD. */
export const goalWeeklyReviewsTable = pgTable("goal_weekly_reviews", {
  goalId: uuid("goal_id")
    .notNull()
    .references(() => goalsTable.id, { onDelete: "cascade" }),
  weekStartDate: text("week_start_date").notNull(),
  checkedAt: timestamp("checked_at").defaultNow().notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.goalId, t.weekStartDate] }) }));

/** Per-user goal reminder email settings (Clerk user_id). */
export const goalReminderSettingsTable = pgTable("goal_reminder_settings", {
  userId: text("user_id").primaryKey(),
  enabled: boolean("enabled").default(false).notNull(),
  /** Local hour to send (0-23). */
  localHour: integer("local_hour").default(9).notNull(),
  /** IANA timezone e.g. America/New_York. */
  timezone: text("timezone").default("UTC").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
