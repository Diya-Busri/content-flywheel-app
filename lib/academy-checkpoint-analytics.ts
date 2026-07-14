/**
 * Analytics events for the Academy Understanding Check checkpoint.
 * Reuses the existing lib/log-event.ts → user_events table — no new
 * analytics infrastructure. Never pass chat content — metadata only.
 */
import { logEvent } from "@/lib/log-event";

export const ACADEMY_CHECKPOINT_EVENTS = {
  OPENED: "academy_checkpoint_opened",
  HELP_OPTION_SELECTED: "academy_help_option_selected",
  QUESTION_SUBMITTED: "academy_question_submitted",
  APPLICATION_STARTED: "academy_application_started",
  APPLICATION_COMPLETED: "academy_application_completed",
  UNDERSTANDING_CONFIRMED: "academy_understanding_confirmed",
  CHECKPOINT_SKIPPED: "academy_checkpoint_skipped",
  NEXT_LESSON_OPENED: "academy_next_lesson_opened",
  // Fired once, the turn a learner crosses the "struggling" threshold on a
  // lesson (3+ questions or 2+ "explain more simply" clicks) — see
  // db/queries/academy-checkpoint-queries.ts getHelpOptionUsageCounts.
  STRUGGLE_DETECTED: "academy_struggle_detected",
} as const;

export type AcademyCheckpointEvent = (typeof ACADEMY_CHECKPOINT_EVENTS)[keyof typeof ACADEMY_CHECKPOINT_EVENTS];

export interface AcademyCheckpointEventMeta {
  courseId: string;
  moduleId?: string | null;
  lessonId: string;
  helpOption?: string | null;
}

/** Fire-and-forget — never blocks or throws (see lib/log-event.ts). Metadata only, no chat content. */
export function logAcademyCheckpointEvent(userId: string, event: AcademyCheckpointEvent, meta: AcademyCheckpointEventMeta): void {
  void logEvent(userId, event, { ...meta });
}
