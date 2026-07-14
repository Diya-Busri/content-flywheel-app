/**
 * Motion Graphics Agent Run — DB access layer.
 *
 * All read/write functions scope to userId — a run can never be read or
 * mutated by a user who doesn't own it.
 *
 * transitionMgRunStatus uses CAS (compare-and-swap): only the first
 * concurrent caller that wins the atomic UPDATE proceeds. Losers get null
 * back and should return the current state rather than re-running work.
 */

import { db } from "@/db/db";
import { mgRunsTable, mgStepsTable } from "@/db/schema/mg-runs-schema";
import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
import type {
  MgRun,
  MgRunStatus,
  MgGate,
  MgPlan,
  MgStep,
  MgRunWithSteps,
} from "./agent-types";
import type { ShortFormOutput } from "./types";

type DbRun  = typeof mgRunsTable.$inferSelect;
type DbStep = typeof mgStepsTable.$inferSelect;

// ─── Row mappers ──────────────────────────────────────────────────────────────

function rowToRun(row: DbRun): MgRun {
  return {
    id:             row.id,
    userId:         row.userId,
    projectId:      row.projectId  ?? undefined,
    contentMode:    row.contentMode as MgRun["contentMode"],
    sourceText:     row.sourceText,
    sourceUrl:      row.sourceUrl  ?? undefined,
    targetAudience: row.targetAudience ?? undefined,
    mainOpinion:    row.mainOpinion    ?? undefined,
    desiredCta:     row.desiredCta     ?? undefined,
    cfMention:      row.cfMention as MgRun["cfMention"],
    videoDuration:  row.videoDuration  ?? undefined,
    tone:           row.tone           ?? undefined,
    aspectRatio:    row.aspectRatio as MgRun["aspectRatio"],
    status:         row.status as MgRunStatus,
    currentGate:    (row.currentGate as MgGate) ?? null,
    plan:           (row.plan as MgPlan | null) ?? undefined,
    shortForm:      (row.shortForm as ShortFormOutput | null) ?? undefined,
    error:          row.error ?? undefined,
    createdAt:      row.createdAt.toISOString(),
    updatedAt:      row.updatedAt.toISOString(),
  };
}

function rowToStep(row: DbStep): MgStep {
  return {
    id:            row.id,
    runId:         row.runId,
    toolName:      row.toolName as MgStep["toolName"],
    attemptNumber: row.attemptNumber,
    status:        row.status as MgStep["status"],
    input:         (row.input as Record<string, unknown> | null) ?? undefined,
    output:        (row.output as Record<string, unknown> | null) ?? undefined,
    error:         row.error ?? undefined,
    startedAt:     row.startedAt?.toISOString(),
    completedAt:   row.completedAt?.toISOString(),
    createdAt:     row.createdAt.toISOString(),
  };
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createMgRun(
  userId: string,
  data: Pick<
    MgRun,
    | "contentMode"
    | "sourceText"
    | "sourceUrl"
    | "targetAudience"
    | "mainOpinion"
    | "desiredCta"
    | "cfMention"
    | "videoDuration"
    | "tone"
    | "aspectRatio"
  >
): Promise<MgRun> {
  const [row] = await db
    .insert(mgRunsTable)
    .values({
      userId,
      status:        "queued",
      contentMode:   data.contentMode,
      sourceText:    data.sourceText,
      sourceUrl:     data.sourceUrl,
      targetAudience: data.targetAudience,
      mainOpinion:   data.mainOpinion,
      desiredCta:    data.desiredCta,
      cfMention:     data.cfMention,
      videoDuration: data.videoDuration,
      tone:          data.tone,
      aspectRatio:   data.aspectRatio,
    })
    .returning();
  if (!row) throw new Error("Failed to create mg_run");
  return rowToRun(row);
}

// ─── Read (ownership-enforced) ────────────────────────────────────────────────

export async function getMgRunForUser(
  userId: string,
  runId: string
): Promise<MgRun | null> {
  const [row] = await db
    .select()
    .from(mgRunsTable)
    .where(and(eq(mgRunsTable.id, runId), eq(mgRunsTable.userId, userId)))
    .limit(1);
  return row ? rowToRun(row) : null;
}

/** Returns steps only if the run belongs to userId (defensive double-check). */
export async function getMgStepsForRun(
  userId: string,
  runId: string
): Promise<MgStep[]> {
  const run = await getMgRunForUser(userId, runId);
  if (!run) return [];
  const rows = await db
    .select()
    .from(mgStepsTable)
    .where(eq(mgStepsTable.runId, runId))
    .orderBy(asc(mgStepsTable.createdAt), asc(mgStepsTable.attemptNumber));
  return rows.map(rowToStep);
}

export async function getMgRunWithSteps(
  userId: string,
  runId: string
): Promise<MgRunWithSteps | null> {
  const run = await getMgRunForUser(userId, runId);
  if (!run) return null;
  const steps = await getMgStepsForRun(userId, runId);
  return { ...run, steps };
}

// ─── CAS status transition ────────────────────────────────────────────────────

export type MgRunPatch = {
  currentGate?: MgGate;
  plan?: MgPlan;
  shortForm?: ShortFormOutput;
  projectId?: string;
  error?: string | null;
};

function buildGateCondition(fromGates?: MgGate[]) {
  if (!fromGates || fromGates.length === 0) return undefined;
  const nonNull = fromGates.filter((g): g is Exclude<MgGate, null> => g !== null);
  const includesNull = fromGates.includes(null);
  const parts = [];
  if (nonNull.length > 0) parts.push(inArray(mgRunsTable.currentGate, nonNull));
  if (includesNull) parts.push(isNull(mgRunsTable.currentGate));
  if (parts.length === 0) return undefined;
  return parts.length === 1 ? parts[0] : or(...parts);
}

/**
 * Compare-and-swap the run's status.
 *
 * Only succeeds if:
 *   - the run belongs to userId
 *   - its current status is one of fromStatuses
 *   - (if fromGates provided) its current_gate is one of fromGates
 *
 * Returns updated run on success, null if the CAS missed (run already moved on).
 * Concurrent callers: only one wins; losers get null and should return current state.
 */
export async function transitionMgRunStatus(
  userId: string,
  runId: string,
  fromStatuses: MgRunStatus[],
  toStatus: MgRunStatus,
  patch: MgRunPatch = {},
  fromGates?: MgGate[]
): Promise<MgRun | null> {
  const gateCond = buildGateCondition(fromGates);
  const [updated] = await db
    .update(mgRunsTable)
    .set({
      status:    toStatus,
      updatedAt: new Date(),
      ...(patch.currentGate !== undefined ? { currentGate: patch.currentGate } : {}),
      ...(patch.plan        !== undefined ? { plan: patch.plan }               : {}),
      ...(patch.shortForm   !== undefined ? { shortForm: patch.shortForm }     : {}),
      ...(patch.projectId   !== undefined ? { projectId: patch.projectId }     : {}),
      ...(patch.error       !== undefined ? { error: patch.error }             : {}),
    })
    .where(
      and(
        eq(mgRunsTable.id, runId),
        eq(mgRunsTable.userId, userId),
        inArray(mgRunsTable.status, fromStatuses),
        ...(gateCond ? [gateCond] : [])
      )
    )
    .returning();
  return updated ? rowToRun(updated) : null;
}

// ─── Step logging ─────────────────────────────────────────────────────────────

/**
 * Insert a step in 'running' state before calling the tool.
 * Returns the step's id for subsequent complete/fail calls.
 *
 * @param input - Minimal diagnostic info only. Do NOT include full sourceText.
 */
export async function startMgStep(
  runId: string,
  toolName: string,
  attemptNumber: number,
  input?: Record<string, unknown>
): Promise<string> {
  const [row] = await db
    .insert(mgStepsTable)
    .values({
      runId,
      toolName,
      attemptNumber,
      status:    "running",
      input,
      startedAt: new Date(),
    })
    .returning({ id: mgStepsTable.id });
  if (!row) throw new Error(`Failed to start mg_step for ${toolName}`);
  return row.id;
}

export async function completeMgStep(
  stepId: string,
  output: Record<string, unknown>
): Promise<void> {
  await db
    .update(mgStepsTable)
    .set({ status: "completed", output, completedAt: new Date() })
    .where(eq(mgStepsTable.id, stepId));
}

export async function failMgStep(stepId: string, error: string): Promise<void> {
  await db
    .update(mgStepsTable)
    .set({ status: "failed", error, completedAt: new Date() })
    .where(eq(mgStepsTable.id, stepId));
}

/** Highest attempt_number for a tool in a run (use + 1 for retry). */
export async function getLatestAttemptNumber(
  runId: string,
  toolName: string
): Promise<number> {
  const [row] = await db
    .select({ n: mgStepsTable.attemptNumber })
    .from(mgStepsTable)
    .where(and(eq(mgStepsTable.runId, runId), eq(mgStepsTable.toolName, toolName)))
    .orderBy(desc(mgStepsTable.attemptNumber))
    .limit(1);
  return row?.n ?? 0;
}

/** Get the saved output of a completed step (used for retry idempotency). */
export async function getCompletedStepOutput(
  runId: string,
  toolName: string
): Promise<Record<string, unknown> | null> {
  const [row] = await db
    .select({ output: mgStepsTable.output })
    .from(mgStepsTable)
    .where(
      and(
        eq(mgStepsTable.runId, runId),
        eq(mgStepsTable.toolName, toolName),
        eq(mgStepsTable.status, "completed")
      )
    )
    .orderBy(desc(mgStepsTable.attemptNumber))
    .limit(1);
  return (row?.output as Record<string, unknown> | null) ?? null;
}
