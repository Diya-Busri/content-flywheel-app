/**
 * Monthly API spend guard — prevents runaway costs from uncapped provider calls.
 *
 * Tracks call counts per USER per provider per calendar month in Supabase.
 * Configurable hard limits via env vars (SPEND_LIMIT_*).
 * Returns a NextResponse 429 when a user's limit is hit.
 *
 * Providers tracked:
 *   openai       → SPEND_LIMIT_OPENAI      (default 50 calls/user/month)
 *   fal          → SPEND_LIMIT_FAL         (default 20 calls/user/month)
 *   higgsfield   → SPEND_LIMIT_HIGGSFIELD  (default 5 calls/user/month)
 *   elevenlabs   → SPEND_LIMIT_ELEVENLABS  (default 30 calls/user/month)
 *
 * Usage:
 *   const guard = await checkSpendLimit("openai", userId);
 *   if (guard) return guard; // returns 429 NextResponse
 *
 * Internal/server-to-server routes without a userId can omit it:
 *   const guard = await checkSpendLimit("higgsfield");
 *   Counts against a shared "__system__" bucket (not per-user).
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export type SpendProvider = "openai" | "fal" | "higgsfield" | "elevenlabs";

// Hard monthly limits per user — override with env vars
const DEFAULT_LIMITS: Record<SpendProvider, number> = {
  openai: 50,
  fal: 20,
  higgsfield: 5,
  elevenlabs: 30,
};

function getLimit(provider: SpendProvider): number {
  const envKey = `SPEND_LIMIT_${provider.toUpperCase()}`;
  const val = process.env[envKey];
  if (val) {
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_LIMITS[provider];
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * Check if a user is under their monthly limit, then increment the counter.
 * Returns null (allowed) or a NextResponse 429 (blocked).
 *
 * @param provider  Which API provider to check
 * @param userId    Clerk userId — omit only for internal server-to-server routes
 */
export async function checkSpendLimit(
  provider: SpendProvider,
  userId?: string
): Promise<NextResponse | null> {
  const limit = getLimit(provider);
  const month = currentMonth();
  const effectiveUserId = userId ?? "__system__";

  const supabase = getSupabase();
  if (!supabase) {
    console.warn(`[spend-guard] Supabase not configured — ${provider} call unchecked`);
    return null;
  }

  try {
    const { data, error } = await supabase.rpc("increment_api_usage", {
      p_user_id: effectiveUserId,
      p_provider: provider,
      p_month: month,
    });

    if (error) {
      console.error(`[spend-guard] RPC error for ${provider}/${effectiveUserId}:`, error.message);
      return null; // fail open
    }

    const newCount = typeof data === "number" ? data : 0;
    console.log(`[spend-guard] ${provider} ${effectiveUserId} ${month}: ${newCount}/${limit}`);

    if (newCount > limit) {
      console.warn(`[spend-guard] BLOCKED ${provider}/${effectiveUserId} — ${newCount} exceeds ${limit}`);
      return new NextResponse(
        JSON.stringify({
          error: `Monthly usage limit reached for this feature (${limit} uses). Resets on the 1st of next month.`,
          code: "SPEND_LIMIT_EXCEEDED",
          provider,
          limit,
          count: newCount,
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    return null; // allowed
  } catch (err) {
    console.error(`[spend-guard] Unexpected error for ${provider}:`, err);
    return null; // fail open
  }
}

/**
 * Get current usage for all providers this month (for admin dashboard).
 */
export async function getMonthlyUsage(): Promise<
  { userId: string; provider: string; month: string; call_count: number; limit: number }[]
> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const month = currentMonth();
  const { data, error } = await supabase
    .from("api_monthly_usage")
    .select("user_id, provider, month, call_count")
    .eq("month", month)
    .order("call_count", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    userId: row.user_id as string,
    provider: row.provider as string,
    month: row.month as string,
    call_count: row.call_count as number,
    limit: getLimit(row.provider as SpendProvider),
  }));
}
