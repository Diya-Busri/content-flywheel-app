import { db } from "@/db/db";
import { executionRunsTable, executionStepsTable } from "@/db/schema/jarvis-schema";
import type {
  ExecutionRunStatus,
  JarvisGate,
  JarvisPlan,
  JarvisFinalSummary,
  ProposedAsset,
  SelectExecutionRun,
  SelectExecutionStep,
} from "@/db/schema/jarvis-schema";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

/**
 * All Jarvis DB access goes through this module. Every function that reads
 * or writes a run takes userId and filters `WHERE user_id = userId` (or,
 * for transitionRunStatus, uses it as part of an atomic compare-and-swap) —
 * this is the ownership boundary: a user can never read or mutate another
 * user's run.
 */

/* ─── Create ─────────────────────────────────────────────────────────────────── */

export async function createRun(userId: string, goal: string): Promise<SelectExecutionRun> {
  const [run] = await db
    .insert(executionRunsTable)
    .values({ userId, goal, status: "queued", assets: [] })
    .returning();
  if (!run) throw new Error("Failed to create Jarvis run");
  return run;
}

/* ─── Read (ownership-enforced) ──────────────────────────────────────────────── */

export async function getRunForUser(
  userId: string,
  runId: string,
): Promise<SelectExecutionRun | null> {
  const [run] = await db
    .select()
    .from(executionRunsTable)
    .where(and(eq(executionRunsTable.id, runId), eq(executionRunsTable.userId, userId)))
    .limit(1);
  return run ?? null;
}

export async function listRunsForUser(
  userId: string,
  limit = 20,
): Promise<SelectExecutionRun[]> {
  return db
    .select()
    .from(executionRunsTable)
    .where(eq(executionRunsTable.userId, userId))
    .orderBy(desc(executionRunsTable.createdAt))
    .limit(limit);
}

/**
 * Ownership is enforced by first confirming the run belongs to userId, then
 * fetching its steps by runId. Defensive even if a caller forgets to check
 * getRunForUser first — steps for a run you don't own are never returned.
 */
export async function getStepsForRun(
  userId: string,
  runId: string,
): Promise<SelectExecutionStep[]> {
  const run = await getRunForUser(userId, runId);
  if (!run) return [];
  return db
    .select()
    .from(executionStepsTable)
    .where(eq(executionStepsTable.runId, runId))
    .orderBy(asc(executionStepsTable.createdAt));
}

/* ─── Atomic status transition (idempotency backbone) ───────────────────────── */

export type RunTransitionPatch = {
  currentGate?: JarvisGate;
  plan?: JarvisPlan | null;
  assets?: ProposedAsset[];
  finalSummary?: JarvisFinalSummary | null;
  error?: string | null;
};

/**
 * Compare-and-swap the run's status. Only succeeds if the run currently has
 * one of `fromStatuses` AND belongs to userId — a single atomic UPDATE, so
 * concurrent requests (double-click, refresh-triggered retry) can never both
 * "win" and run the same phase twice. The loser gets null back and should
 * simply return the current (already-in-progress or already-completed) state
 * to the client instead of redoing the work.
 */
export async function transitionRunStatus(
  userId: string,
  runId: string,
  fromStatuses: ExecutionRunStatus[],
  toStatus: ExecutionRunStatus,
  patch: RunTransitionPatch = {},
): Promise<SelectExecutionRun | null> {
  const [updated] = await db
    .update(executionRunsTable)
    .set({
      status: toStatus,
      updatedAt: new Date(),
      ...(patch.currentGate !== undefined ? { currentGate: patch.currentGate } : {}),
      ...(patch.plan !== undefined ? { plan: patch.plan } : {}),
      ...(patch.assets !== undefined ? { assets: patch.assets } : {}),
      ...(patch.finalSummary !== undefined ? { finalSummary: patch.finalSummary } : {}),
      ...(patch.error !== undefined ? { error: patch.error } : {}),
    })
    .where(
      and(
        eq(executionRunsTable.id, runId),
        eq(executionRunsTable.userId, userId),
        inArray(executionRunsTable.status, fromStatuses),
      ),
    )
    .returning();
  return updated ?? null;
}

/**
 * Non-CAS patch for updating fields on a run without changing status
 * (e.g. persisting an asset edit while still in asset_review). Still
 * ownership-scoped.
 */
export async function patchRun(
  userId: string,
  runId: string,
  patch: RunTransitionPatch,
): Promise<SelectExecutionRun | null> {
  const [updated] = await db
    .update(executionRunsTable)
    .set({
      updatedAt: new Date(),
      ...(patch.currentGate !== undefined ? { currentGate: patch.currentGate } : {}),
      ...(patch.plan !== undefined ? { plan: patch.plan } : {}),
      ...(patch.assets !== undefined ? { assets: patch.assets } : {}),
      ...(patch.finalSummary !== undefined ? { finalSummary: patch.finalSummary } : {}),
      ...(patch.error !== undefined ? { error: patch.error } : {}),
    })
    .where(and(eq(executionRunsTable.id, runId), eq(executionRunsTable.userId, userId)))
    .returning();
  return updated ?? null;
}
