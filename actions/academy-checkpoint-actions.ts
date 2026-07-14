"use server";

import { auth } from "@clerk/nextjs/server";
import { ActionResult } from "@/types/actions/actions-types";
import { getLessonById } from "@/db/queries/academy-queries";
import * as cq from "@/db/queries/academy-checkpoint-queries";
import { SelectAcademyLessonCheckpoint, SelectAcademyCheckpointMessage } from "@/db/schema/academy-checkpoints-schema";
import { isAcademyCheckpointEnabled } from "@/lib/academy/checkpoint-guard";
import { logAcademyCheckpointEvent, ACADEMY_CHECKPOINT_EVENTS } from "@/lib/academy-checkpoint-analytics";
import { describeHelpUsage } from "@/lib/academy-checkpoint-prompt";
import { saveUserMemory } from "@/lib/user-memory";
import { getUnlockedUnderstandingAchievement, UnderstandingAchievement } from "@/lib/academy-checkpoint-achievements";

async function requireUser(): Promise<{ userId: string }> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return { userId };
}

/** Looks up the lesson and confirms the checkpoint feature is enabled for this user (belt-and-braces — the lesson page already gates rendering). */
async function requireEnabledLesson(userId: string, lessonId: string) {
  const lesson = await getLessonById(lessonId);
  if (!lesson) throw new Error("Lesson not found");
  const enabled = await isAcademyCheckpointEnabled(userId);
  if (!enabled) throw new Error("Understanding Check is not enabled for this account yet");
  return lesson;
}

function ok<T>(data: T, message = "OK"): ActionResult<T> {
  return { isSuccess: true, message, data };
}
function fail<T>(error: unknown, fallback: string): ActionResult<T> {
  const msg = error instanceof Error ? error.message : fallback;
  return { isSuccess: false, message: msg };
}

export interface CheckpointState {
  checkpoint: SelectAcademyLessonCheckpoint;
  messages: SelectAcademyCheckpointMessage[];
  /** True if a prior session on this checkpoint already crossed the struggling threshold. */
  struggling: boolean;
}

/**
 * Open (or resume) a lesson's checkpoint. No AI call — pure DB read/write.
 * Safe to call every time the panel opens; the unique (user_id, lesson_id)
 * index guarantees this never creates duplicate rows.
 */
export async function openCheckpointAction(lessonId: string): Promise<ActionResult<CheckpointState>> {
  try {
    const { userId } = await requireUser();
    const lesson = await requireEnabledLesson(userId, lessonId);
    const checkpoint = await cq.markCheckpointOpened(userId, lessonId, lesson.courseId);
    const messages = await cq.getCheckpointMessages(checkpoint.id);
    const struggling = cq.isStruggling(await cq.getHelpOptionUsageCounts(checkpoint.id));
    logAcademyCheckpointEvent(userId, ACADEMY_CHECKPOINT_EVENTS.OPENED, {
      courseId: lesson.courseId,
      moduleId: lesson.moduleId,
      lessonId,
    });
    return ok({ checkpoint, messages, struggling });
  } catch (e) {
    return fail(e, "Failed to open checkpoint");
  }
}

export interface ConfirmUnderstandingResult {
  checkpoint: SelectAcademyLessonCheckpoint;
  /** Set only the turn a NEW confirmation happens to cross an achievement threshold — never re-fires on reopen. */
  unlockedAchievement: UnderstandingAchievement | null;
}

/** "Yes, I understand" — pure DB write. Never calls the model, never touches rate limits or spend guard. */
export async function confirmUnderstandingAction(lessonId: string): Promise<ActionResult<ConfirmUnderstandingResult>> {
  try {
    const { userId } = await requireUser();
    const lesson = await getLessonById(lessonId);
    if (!lesson) throw new Error("Lesson not found");

    const before = await cq.getCheckpoint(userId, lessonId);
    const wasAlreadyConfirmed = !!before?.understandingConfirmed;
    const checkpoint = await cq.confirmUnderstanding(userId, lessonId, lesson.courseId);
    logAcademyCheckpointEvent(userId, ACADEMY_CHECKPOINT_EVENTS.UNDERSTANDING_CONFIRMED, {
      courseId: lesson.courseId,
      moduleId: lesson.moduleId,
      lessonId,
    });

    // Understanding-achievement track — a genuinely new confirmation only, never
    // re-triggered by reopening an already-confirmed checkpoint.
    let unlockedAchievement: UnderstandingAchievement | null = null;
    if (!wasAlreadyConfirmed) {
      const count = await cq.getUnderstandingConfirmedCount(userId, lesson.courseId);
      unlockedAchievement = getUnlockedUnderstandingAchievement(count);
    }

    // Auto-tag into Business Brain — deliberately different from the explicit
    // "Save to Business Brain" button for application output: this fires
    // automatically, but ONLY when the learner genuinely needed real help
    // (crossed the same "struggling" threshold used for the support nudge)
    // before confirming, and only once ever per checkpoint. Content is a
    // short structured summary, never the raw chat transcript. Never blocks
    // or fails the confirm itself if this has a problem.
    if (!before?.struggleMemorySavedAt) {
      try {
        const counts = await cq.getHelpOptionUsageCounts(checkpoint.id);
        if (cq.isStruggling(counts)) {
          await saveUserMemory({
            userId,
            category: "notes",
            type: "automatic",
            title: `${lesson.title} — needed extra help`,
            content: `While completing "${lesson.title}", the learner ${describeHelpUsage(
              counts
            )} before confirming they understood it. Related topics may benefit from extra clarity or examples.`,
            source: "coach",
            metadata: { lessonId, courseId: lesson.courseId, autoTagged: true },
          });
          await cq.markStruggleMemorySaved(checkpoint.id);
        }
      } catch (memErr) {
        console.warn("[academy-checkpoint] failed to auto-tag struggle memory:", memErr);
      }
    }

    return ok({ checkpoint, unlockedAchievement }, "Understanding confirmed");
  } catch (e) {
    return fail(e, "Failed to confirm understanding");
  }
}

/** "Skip for now" — never blocks progression. The checkpoint stays available on a future visit. */
export async function skipCheckpointAction(lessonId: string): Promise<ActionResult<SelectAcademyLessonCheckpoint>> {
  try {
    const { userId } = await requireUser();
    const lesson = await getLessonById(lessonId);
    if (!lesson) throw new Error("Lesson not found");
    const checkpoint = await cq.skipCheckpoint(userId, lessonId, lesson.courseId);
    logAcademyCheckpointEvent(userId, ACADEMY_CHECKPOINT_EVENTS.CHECKPOINT_SKIPPED, {
      courseId: lesson.courseId,
      moduleId: lesson.moduleId,
      lessonId,
    });
    return ok(checkpoint, "Skipped");
  } catch (e) {
    return fail(e, "Failed to skip checkpoint");
  }
}

/** Logs a quick-action click. Purely for analytics — no AI call, safe to fire before the AI request goes out. */
export async function logHelpOptionSelectedAction(lessonId: string, helpOption: string): Promise<ActionResult<null>> {
  try {
    const { userId } = await requireUser();
    const lesson = await getLessonById(lessonId);
    if (!lesson) throw new Error("Lesson not found");
    await cq.setLastHelpOption((await cq.getOrCreateCheckpoint(userId, lessonId, lesson.courseId)).id, helpOption as any);
    logAcademyCheckpointEvent(userId, ACADEMY_CHECKPOINT_EVENTS.HELP_OPTION_SELECTED, {
      courseId: lesson.courseId,
      moduleId: lesson.moduleId,
      lessonId,
      helpOption,
    });
    if (helpOption === "apply") {
      logAcademyCheckpointEvent(userId, ACADEMY_CHECKPOINT_EVENTS.APPLICATION_STARTED, {
        courseId: lesson.courseId,
        moduleId: lesson.moduleId,
        lessonId,
      });
    }
    return ok(null);
  } catch (e) {
    return fail(e, "Failed to log selection");
  }
}

export async function logNextLessonOpenedAction(lessonId: string): Promise<ActionResult<null>> {
  try {
    const { userId } = await requireUser();
    const lesson = await getLessonById(lessonId);
    if (!lesson) throw new Error("Lesson not found");
    logAcademyCheckpointEvent(userId, ACADEMY_CHECKPOINT_EVENTS.NEXT_LESSON_OPENED, {
      courseId: lesson.courseId,
      moduleId: lesson.moduleId,
      lessonId,
    });
    return ok(null);
  } catch (e) {
    return fail(e, "Failed to log event");
  }
}

/**
 * Persist an opt-in generated visual (see generateVisual in useAcademyCheckpointChat)
 * against the checkpoint message it belongs to, so it survives closing/reopening the
 * panel. Never called automatically — only after the client has already generated the
 * image via /api/chat/coach/generate-image and just wants it saved.
 */
export async function saveMessageVisualAction(messageId: string, imageUrl: string): Promise<ActionResult<null>> {
  try {
    const { userId } = await requireUser();
    const updated = await cq.setMessageImageUrl(messageId, userId, imageUrl);
    if (!updated) throw new Error("Message not found");
    return ok(null);
  } catch (e) {
    return fail(e, "Failed to save visual");
  }
}

/**
 * Explicit "Save" action for generated application output → Business Brain / AI Memory.
 * NEVER called automatically — only in direct response to the user clicking Save.
 */
export async function saveApplicationOutputToMemoryAction(lessonId: string): Promise<ActionResult<null>> {
  try {
    const { userId } = await requireUser();
    const lesson = await getLessonById(lessonId);
    if (!lesson) throw new Error("Lesson not found");
    const checkpoint = await cq.getCheckpoint(userId, lessonId);
    if (!checkpoint?.applicationOutput) throw new Error("No application output to save yet");

    const content =
      typeof checkpoint.applicationOutput === "string"
        ? checkpoint.applicationOutput
        : JSON.stringify(checkpoint.applicationOutput);

    await saveUserMemory({
      userId,
      category: "notes",
      type: "automatic",
      title: `${lesson.title} — application exercise`,
      content,
      source: "coach",
      metadata: { lessonId, courseId: lesson.courseId },
    });
    await cq.markApplicationOutputSaved(checkpoint.id);
    return ok(null, "Saved to your Business Brain");
  } catch (e) {
    return fail(e, "Failed to save");
  }
}
