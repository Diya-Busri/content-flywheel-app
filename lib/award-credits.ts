/**
 * Central video credit award function.
 *
 * Every credit grant in the codebase goes through here so that:
 * 1. Atomic SQL increment — no read-modify-write race condition
 * 2. Idempotency guard — duplicate webhook fires / retries are silently skipped
 * 3. Consistent audit trail in video_credit_transactions
 * 4. Single log prefix "[award-credits]" for easy grepping
 *
 * See migration: add-video-credit-idempotency-key.sql
 */
import { db } from "@/db/db";
import { profilesTable } from "@/db/schema/profiles-schema";
import { videoCreditTransactionsTable } from "@/db/schema/video-credit-transactions-schema";
import { eq, sql } from "drizzle-orm";

export interface AwardCreditsResult {
  success: boolean;
  /** New balance after the grant (0 when skipped or failed). */
  newBalance: number;
  /** true when the idempotency key was already used — no credits were added. */
  skipped: boolean;
}

/**
 * Award video credits to a user.
 *
 * @param userId        Clerk user ID
 * @param amount        Credits to add (must be > 0)
 * @param reason        Human-readable description logged in the transaction table
 * @param idempotencyKey  Optional unique key. If supplied and already present in the
 *                        transactions table, the grant is silently skipped.
 *                        Use format: "clerk:signup:{userId}" | "stripe:invoice:{id}" | "stripe:session:{id}"
 */
export async function awardVideoCredits({
  userId,
  amount,
  reason,
  idempotencyKey,
}: {
  userId: string;
  amount: number;
  reason: string;
  idempotencyKey?: string;
}): Promise<AwardCreditsResult> {
  if (amount <= 0) {
    console.warn(`[award-credits] Skipping non-positive amount=${amount} for userId=${userId}`);
    return { success: false, newBalance: 0, skipped: false };
  }

  // ── Idempotency check ────────────────────────────────────────────────────────
  if (idempotencyKey) {
    const [existing] = await db
      .select({ id: videoCreditTransactionsTable.id })
      .from(videoCreditTransactionsTable)
      .where(eq(videoCreditTransactionsTable.idempotencyKey, idempotencyKey))
      .limit(1);

    if (existing) {
      console.log(
        `[award-credits] Skipping — already processed | key=${idempotencyKey} | userId=${userId}`
      );
      return { success: true, newBalance: 0, skipped: true };
    }
  }

  // ── Atomic increment ─────────────────────────────────────────────────────────
  let newBalance = 0;
  try {
    const [updated] = await db
      .update(profilesTable)
      .set({ videoCredits: sql`${profilesTable.videoCredits} + ${amount}` })
      .where(eq(profilesTable.userId, userId))
      .returning({ videoCredits: profilesTable.videoCredits });

    if (!updated) {
      console.error(`[award-credits] Profile not found | userId=${userId} | reason="${reason}"`);
      return { success: false, newBalance: 0, skipped: false };
    }

    newBalance = updated.videoCredits;
  } catch (err) {
    console.error(`[award-credits] DB update failed | userId=${userId} | reason="${reason}"`, err);
    return { success: false, newBalance: 0, skipped: false };
  }

  // ── Transaction log ──────────────────────────────────────────────────────────
  await db
    .insert(videoCreditTransactionsTable)
    .values({
      userId,
      type: "purchase",
      amount,
      description: reason,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    })
    .catch((e: unknown) =>
      console.error("[award-credits] Failed to log transaction:", e)
    );

  console.log(
    `[award-credits] +${amount} credits | userId=${userId} | balance=${newBalance} | reason="${reason}"` +
    (idempotencyKey ? ` | key=${idempotencyKey}` : "")
  );

  return { success: true, newBalance, skipped: false };
}
