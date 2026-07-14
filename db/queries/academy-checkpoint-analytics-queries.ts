/**
 * Admin analytics for the Academy Understanding Check checkpoint — built
 * entirely from the events already logged via lib/academy-checkpoint-analytics.ts
 * into the existing user_events table. No new tracking, no new tables.
 */
import { db } from "@/db/db";
import { userEventsTable } from "@/db/schema/user-events-schema";
import { academyLessonsTable, academyCoursesTable } from "@/db/schema/academy-schema";
import { ACADEMY_CHECKPOINT_EVENTS } from "@/lib/academy-checkpoint-analytics";
import { CHECKPOINT_HELP_OPTIONS, CheckpointHelpOption } from "@/db/schema/academy-checkpoints-schema";
import { sql, inArray, eq } from "drizzle-orm";

export interface CheckpointLessonAnalytics {
  lessonId: string;
  lessonTitle: string;
  courseTitle: string;
  opened: number;
  understandingConfirmed: number;
  skipped: number;
  questionsSubmitted: number;
  struggleDetected: number;
  helpOptionCounts: Record<CheckpointHelpOption, number>;
}

function emptyHelpOptionCounts(): Record<CheckpointHelpOption, number> {
  return CHECKPOINT_HELP_OPTIONS.reduce(
    (acc, key) => ({ ...acc, [key]: 0 }),
    {} as Record<CheckpointHelpOption, number>
  );
}

/**
 * Per-lesson breakdown: opened / understood / skipped counts, help-option
 * usage, and questions asked — everything an admin needs to see which lessons
 * confuse learners most, and how they're asking for help.
 */
export async function getCheckpointLessonAnalytics(): Promise<CheckpointLessonAnalytics[]> {
  const events = Object.values(ACADEMY_CHECKPOINT_EVENTS);

  const rows = await db
    .select({
      lessonId: sql<string | null>`(${userEventsTable.metadata}->>'lessonId')`,
      event: userEventsTable.event,
      helpOption: sql<string | null>`(${userEventsTable.metadata}->>'helpOption')`,
      count: sql<number>`count(*)::int`,
    })
    .from(userEventsTable)
    .where(inArray(userEventsTable.event, events as string[]))
    .groupBy(
      sql`(${userEventsTable.metadata}->>'lessonId')`,
      userEventsTable.event,
      sql`(${userEventsTable.metadata}->>'helpOption')`
    );

  const byLesson = new Map<string, CheckpointLessonAnalytics>();
  const get = (lessonId: string) => {
    let entry = byLesson.get(lessonId);
    if (!entry) {
      entry = {
        lessonId,
        lessonTitle: "(deleted lesson)",
        courseTitle: "",
        opened: 0,
        understandingConfirmed: 0,
        skipped: 0,
        questionsSubmitted: 0,
        struggleDetected: 0,
        helpOptionCounts: emptyHelpOptionCounts(),
      };
      byLesson.set(lessonId, entry);
    }
    return entry;
  };

  for (const row of rows) {
    if (!row.lessonId) continue; // events logged before lessonId was included, if any — skip rather than misattribute
    const entry = get(row.lessonId);
    const count = row.count ?? 0;
    switch (row.event) {
      case ACADEMY_CHECKPOINT_EVENTS.OPENED:
        entry.opened += count;
        break;
      case ACADEMY_CHECKPOINT_EVENTS.UNDERSTANDING_CONFIRMED:
        entry.understandingConfirmed += count;
        break;
      case ACADEMY_CHECKPOINT_EVENTS.CHECKPOINT_SKIPPED:
        entry.skipped += count;
        break;
      case ACADEMY_CHECKPOINT_EVENTS.QUESTION_SUBMITTED:
        entry.questionsSubmitted += count;
        break;
      case ACADEMY_CHECKPOINT_EVENTS.STRUGGLE_DETECTED:
        entry.struggleDetected += count;
        break;
      case ACADEMY_CHECKPOINT_EVENTS.HELP_OPTION_SELECTED:
        if (row.helpOption && (CHECKPOINT_HELP_OPTIONS as readonly string[]).includes(row.helpOption)) {
          entry.helpOptionCounts[row.helpOption as CheckpointHelpOption] += count;
        }
        break;
      default:
        break;
    }
  }

  const lessonIds = Array.from(byLesson.keys());
  if (lessonIds.length > 0) {
    const lessonRows = await db
      .select({ id: academyLessonsTable.id, title: academyLessonsTable.title, courseTitle: academyCoursesTable.title })
      .from(academyLessonsTable)
      .innerJoin(academyCoursesTable, eq(academyCoursesTable.id, academyLessonsTable.courseId))
      .where(inArray(academyLessonsTable.id, lessonIds));
    for (const l of lessonRows) {
      const entry = byLesson.get(l.id);
      if (entry) {
        entry.lessonTitle = l.title;
        entry.courseTitle = l.courseTitle;
      }
    }
  }

  return Array.from(byLesson.values()).sort((a, b) => b.opened - a.opened);
}
