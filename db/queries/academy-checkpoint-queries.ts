import { db } from "@/db/db";
import {
  academyLessonCheckpointsTable,
  academyCheckpointMessagesTable,
  InsertAcademyCheckpointMessage,
  SelectAcademyLessonCheckpoint,
  SelectAcademyCheckpointMessage,
  CheckpointHelpOption,
  CHECKPOINT_HELP_OPTIONS,
} from "@/db/schema/academy-checkpoints-schema";
import { and, asc, eq, sql } from "drizzle-orm";

/**
 * Get the existing checkpoint for (userId, lessonId), or create one.
 * The unique index on (user_id, lesson_id) makes this safe against races —
 * onConflictDoNothing + a follow-up select guarantees we never create
 * duplicate rows when a user reopens a lesson.
 */
export async function getOrCreateCheckpoint(
  userId: string,
  lessonId: string,
  courseId: string
): Promise<SelectAcademyLessonCheckpoint> {
  const [inserted] = await db
    .insert(academyLessonCheckpointsTable)
    .values({ userId, lessonId, courseId, status: "not_opened" })
    .onConflictDoNothing({ target: [academyLessonCheckpointsTable.userId, academyLessonCheckpointsTable.lessonId] })
    .returning();
  if (inserted) return inserted;

  const [existing] = await db
    .select()
    .from(academyLessonCheckpointsTable)
    .where(and(eq(academyLessonCheckpointsTable.userId, userId), eq(academyLessonCheckpointsTable.lessonId, lessonId)))
    .limit(1);
  return existing;
}

export async function getCheckpoint(userId: string, lessonId: string): Promise<SelectAcademyLessonCheckpoint | undefined> {
  const rows = await db
    .select()
    .from(academyLessonCheckpointsTable)
    .where(and(eq(academyLessonCheckpointsTable.userId, userId), eq(academyLessonCheckpointsTable.lessonId, lessonId)))
    .limit(1);
  return rows[0];
}

export interface CourseCheckpointRecap {
  lessonsWithCheckpoint: number;
  understoodCount: number;
  skippedCount: number;
  helpUsedCount: number;
}

/**
 * Course-wide rollup of a learner's Understanding Check activity — powers the
 * course-complete screen's recap (see LessonComplete.tsx). Built entirely from
 * academy_lesson_checkpoints, which already has course_id — no new query shape.
 */
export async function getCourseCheckpointRecap(userId: string, courseId: string): Promise<CourseCheckpointRecap> {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      understood: sql<number>`count(*) filter (where ${academyLessonCheckpointsTable.understandingConfirmed} = true)::int`,
      skipped: sql<number>`count(*) filter (where ${academyLessonCheckpointsTable.status} = 'skipped')::int`,
      helpUsed: sql<number>`count(*) filter (where ${academyLessonCheckpointsTable.lastHelpOption} is not null)::int`,
    })
    .from(academyLessonCheckpointsTable)
    .where(and(eq(academyLessonCheckpointsTable.userId, userId), eq(academyLessonCheckpointsTable.courseId, courseId)));

  return {
    lessonsWithCheckpoint: row?.total ?? 0,
    understoodCount: row?.understood ?? 0,
    skippedCount: row?.skipped ?? 0,
    helpUsedCount: row?.helpUsed ?? 0,
  };
}

/** Per-course count of confirmed-understanding checkpoints — backs the understanding-achievement track (see lib/academy-checkpoint-achievements.ts). */
export async function getUnderstandingConfirmedCount(userId: string, courseId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(academyLessonCheckpointsTable)
    .where(
      and(
        eq(academyLessonCheckpointsTable.userId, userId),
        eq(academyLessonCheckpointsTable.courseId, courseId),
        eq(academyLessonCheckpointsTable.understandingConfirmed, true)
      )
    );
  return row?.count ?? 0;
}

export async function getCheckpointById(checkpointId: string): Promise<SelectAcademyLessonCheckpoint | undefined> {
  const rows = await db
    .select()
    .from(academyLessonCheckpointsTable)
    .where(eq(academyLessonCheckpointsTable.id, checkpointId))
    .limit(1);
  return rows[0];
}

/** Deterministic chronological order via `seq`, not just created_at. */
export async function getCheckpointMessages(checkpointId: string): Promise<SelectAcademyCheckpointMessage[]> {
  return db
    .select()
    .from(academyCheckpointMessagesTable)
    .where(eq(academyCheckpointMessagesTable.checkpointId, checkpointId))
    .orderBy(asc(academyCheckpointMessagesTable.seq));
}

export async function markCheckpointOpened(userId: string, lessonId: string, courseId: string): Promise<SelectAcademyLessonCheckpoint> {
  const checkpoint = await getOrCreateCheckpoint(userId, lessonId, courseId);
  // Don't downgrade an already-understood/skipped checkpoint back to "opened" bookkeeping-wise,
  // but always bump lastInteractionAt / openedAt-if-unset so "resume where you stopped" works.
  const [row] = await db
    .update(academyLessonCheckpointsTable)
    .set({
      status: checkpoint.status === "not_opened" ? "opened" : checkpoint.status,
      openedAt: checkpoint.openedAt ?? new Date(),
      lastInteractionAt: new Date(),
    })
    .where(eq(academyLessonCheckpointsTable.id, checkpoint.id))
    .returning();
  return row;
}

export async function confirmUnderstanding(userId: string, lessonId: string, courseId: string): Promise<SelectAcademyLessonCheckpoint> {
  const checkpoint = await getOrCreateCheckpoint(userId, lessonId, courseId);
  const [row] = await db
    .update(academyLessonCheckpointsTable)
    .set({
      status: "understood",
      understandingConfirmed: true,
      understandingConfirmedAt: new Date(),
      lastInteractionAt: new Date(),
    })
    .where(eq(academyLessonCheckpointsTable.id, checkpoint.id))
    .returning();
  return row;
}

/** "Skip for now" — checkpoint stays available on revisit, just don't auto-force it open again this session. */
export async function skipCheckpoint(userId: string, lessonId: string, courseId: string): Promise<SelectAcademyLessonCheckpoint> {
  const checkpoint = await getOrCreateCheckpoint(userId, lessonId, courseId);
  if (checkpoint.understandingConfirmed) return checkpoint; // never downgrade a confirmed checkpoint
  const [row] = await db
    .update(academyLessonCheckpointsTable)
    .set({ status: "skipped", skippedAt: new Date(), lastInteractionAt: new Date() })
    .where(eq(academyLessonCheckpointsTable.id, checkpoint.id))
    .returning();
  return row;
}

/**
 * Counts how many times the learner picked each help option on THIS
 * checkpoint (user-turn messages only). Backs the "struggling" nudge — 3+
 * questions or 2+ "explain more simply" clicks — without any new tracking;
 * this is the same helpOption already stored per message.
 */
export async function getHelpOptionUsageCounts(checkpointId: string): Promise<Record<CheckpointHelpOption, number>> {
  const counts = CHECKPOINT_HELP_OPTIONS.reduce(
    (acc, key) => ({ ...acc, [key]: 0 }),
    {} as Record<CheckpointHelpOption, number>
  );
  const rows = await db
    .select({ helpOption: academyCheckpointMessagesTable.helpOption, count: sql<number>`count(*)::int` })
    .from(academyCheckpointMessagesTable)
    .where(and(eq(academyCheckpointMessagesTable.checkpointId, checkpointId), eq(academyCheckpointMessagesTable.role, "user")))
    .groupBy(academyCheckpointMessagesTable.helpOption);
  for (const row of rows) {
    if (row.helpOption && (CHECKPOINT_HELP_OPTIONS as readonly string[]).includes(row.helpOption)) {
      counts[row.helpOption as CheckpointHelpOption] = row.count ?? 0;
    }
  }
  return counts;
}

/** Threshold used consistently by both the live chat route and hydration on reopen. */
export function isStruggling(counts: Record<CheckpointHelpOption, number>): boolean {
  return counts.question >= 3 || counts.explain_simpler >= 2;
}

export async function setLastHelpOption(checkpointId: string, option: CheckpointHelpOption): Promise<void> {
  await db
    .update(academyLessonCheckpointsTable)
    .set({ lastHelpOption: option, lastInteractionAt: new Date() })
    .where(eq(academyLessonCheckpointsTable.id, checkpointId));
}

/** Auto-persisted whenever "Help me apply this" produces output — this is the checkpoint's own record, not Business Brain/AI Memory. */
export async function saveApplicationOutput(checkpointId: string, output: unknown): Promise<void> {
  await db
    .update(academyLessonCheckpointsTable)
    .set({ applicationOutput: output as any, lastInteractionAt: new Date() })
    .where(eq(academyLessonCheckpointsTable.id, checkpointId));
}

export async function markApplicationOutputSaved(checkpointId: string): Promise<void> {
  await db
    .update(academyLessonCheckpointsTable)
    .set({ applicationOutputSavedAt: new Date() })
    .where(eq(academyLessonCheckpointsTable.id, checkpointId));
}

export async function markStruggleMemorySaved(checkpointId: string): Promise<void> {
  await db
    .update(academyLessonCheckpointsTable)
    .set({ struggleMemorySavedAt: new Date() })
    .where(eq(academyLessonCheckpointsTable.id, checkpointId));
}

/**
 * Persist an opt-in generated visual against the message it belongs to.
 * Ownership-checked via a join to the parent checkpoint's user_id — never
 * trusts a bare message id from the client without confirming it's theirs.
 * Returns false (no-op) if the message doesn't belong to this user, so the
 * caller can fail closed without leaking whether the id exists at all.
 */
export async function setMessageImageUrl(messageId: string, userId: string, imageUrl: string): Promise<boolean> {
  const owned = await db
    .select({ id: academyCheckpointMessagesTable.id })
    .from(academyCheckpointMessagesTable)
    .innerJoin(academyLessonCheckpointsTable, eq(academyLessonCheckpointsTable.id, academyCheckpointMessagesTable.checkpointId))
    .where(and(eq(academyCheckpointMessagesTable.id, messageId), eq(academyLessonCheckpointsTable.userId, userId)))
    .limit(1);
  if (owned.length === 0) return false;

  await db
    .update(academyCheckpointMessagesTable)
    .set({ imageUrl })
    .where(eq(academyCheckpointMessagesTable.id, messageId));
  return true;
}

/**
 * Append a message with a monotonic per-checkpoint `seq` (computed in the same
 * insert via a subquery) so ordering is deterministic even under concurrent
 * writes at the same millisecond.
 */
export async function appendCheckpointMessage(
  data: Omit<InsertAcademyCheckpointMessage, "seq">
): Promise<SelectAcademyCheckpointMessage> {
  const [row] = await db
    .insert(academyCheckpointMessagesTable)
    .values({
      ...data,
      seq: sql`COALESCE((SELECT MAX(seq) FROM academy_checkpoint_messages WHERE checkpoint_id = ${data.checkpointId}), 0) + 1`,
    } as unknown as InsertAcademyCheckpointMessage)
    .returning();
  return row;
}
