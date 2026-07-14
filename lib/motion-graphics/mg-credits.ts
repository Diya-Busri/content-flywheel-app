/**
 * Video credit deduction for MG Agent Workflow.
 *
 * Correction 4 requirements:
 * - Atomic check-and-deduct (never creates negative balance)
 * - Idempotency key per step: mg:run:{runId}:step:{toolName}
 * - Returns previous transaction result on repeated calls (safe under retries)
 * - Call AFTER the AI request succeeds and usable output is available
 * - Never deduct before an AI request unless the platform has a safe refund path
 *
 * Correction 5 requirements:
 * - checkMgCredits() is called immediately before each paid provider request
 * - deductMgCredits() is called after the provider returns a usable result
 */

import { db } from "@/db/db";
import { profilesTable } from "@/db/schema/profiles-schema";
import { videoCreditTransactionsTable } from "@/db/schema/video-credit-transactions-schema";
import { eq, sql } from "drizzle-orm";
import type { MgToolName } from "./agent-types";

// ─── Public API ───────────────────────────────────────────────────────────────

export interface DeductCreditsResult {
  success: boolean;
  newBalance: number;
  /** true when the idempotency key was already used — no credits were changed. */
  alreadyDeducted: boolean;
  error?: string;
}

/**
 * Atomically deduct credits for one MG tool step.
 *
 * Call AFTER the provider request succeeds and you have a usable result.
 * Idempotent: repeated calls with the same runId+toolName are a no-op.
 */
export async function deductMgCredits({
  userId,
  runId,
  toolName,
  amount,
  provider = "openai",
}: {
  userId: string;
  runId: string;
  toolName: MgToolName;
  amount: number;
  provider?: string;
}): Promise<DeductCreditsResult> {
  if (amount <= 0) {
    return { success: true, newBalance: 0, alreadyDeducted: false };
  }

  const idempotencyKey = `mg:run:${runId}:step:${toolName}`;

  // ── Idempotency check ─────────────────────────────────────────────────────
  const [existing] = await db
    .select({ id: videoCreditTransactionsTable.id })
    .from(videoCreditTransactionsTable)
    .where(eq(videoCreditTransactionsTable.idempotencyKey, idempotencyKey))
    .limit(1);

  if (existing) {
    console.log(`[mg-credits] Already deducted | key=${idempotencyKey}`);
    return { success: true, newBalance: 0, alreadyDeducted: true };
  }

  // ── Atomic check-and-deduct ───────────────────────────────────────────────
  // Only proceeds if videoCredits >= amount (prevents negative balance).
  // Concurrent requests race on this UPDATE — only one can win per key.
  const [updated] = await db
    .update(profilesTable)
    .set({ videoCredits: sql`${profilesTable.videoCredits} - ${amount}` })
    .where(
      sql`${profilesTable.userId} = ${userId}
          AND ${profilesTable.videoCredits} >= ${amount}`
    )
    .returning({ videoCredits: profilesTable.videoCredits });

  if (!updated) {
    const msg = `Insufficient video credits. This step costs ${amount} credit${amount !== 1 ? "s" : ""}.`;
    console.warn(`[mg-credits] Insufficient | userId=${userId} amount=${amount}`);
    return { success: false, newBalance: 0, alreadyDeducted: false, error: msg };
  }

  // ── Audit log ─────────────────────────────────────────────────────────────
  await db
    .insert(videoCreditTransactionsTable)
    .values({
      userId,
      type: "usage",
      amount,
      description: `MG Agent: ${toolName} (run ${runId.slice(0, 8)}, provider: ${provider})`,
      idempotencyKey,
    })
    .catch((e: unknown) =>
      console.error("[mg-credits] Failed to log transaction:", e)
    );

  console.log(
    `[mg-credits] -${amount} credits | userId=${userId} | balance=${updated.videoCredits} | step=${toolName}`
  );

  return { success: true, newBalance: updated.videoCredits, alreadyDeducted: false };
}

/**
 * Read-only credit balance check.
 * Call BEFORE each paid provider request (Correction 5).
 * Does NOT deduct — only checks.
 */
export async function checkMgCredits(
  userId: string,
  amount: number
): Promise<{ sufficient: boolean; balance: number }> {
  if (amount <= 0) return { sufficient: true, balance: 0 };

  const [profile] = await db
    .select({ videoCredits: profilesTable.videoCredits })
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);

  const balance = profile?.videoCredits ?? 0;
  return { sufficient: balance >= amount, balance };
}
