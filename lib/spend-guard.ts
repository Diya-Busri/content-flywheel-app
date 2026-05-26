/**
 * Monthly API spend guard — prevents runaway costs from uncapped provider calls.
 *
 * Tracks call counts per provider per calendar month in Supabase.
 * Configurable hard limits via env vars (SPEND_LIMIT_*).
 * Returns a NextResponse 429 when a provider limit is hit.
 *
 * Providers tracked:
 *   openai       → SPEND_LIMIT_OPENAI      (default 300 calls/month)
 *   fal          → SPEND_LIMIT_FAL         (default 150 calls/month)
 *   higgsfield   → SPEND_LIMIT_HIGGSFIELD  (default 60 calls/month)
 *   elevenlabs   → SPEND_LIMIT_ELEVENLABS  (default 200 calls/month)
 *
 * Usage:
 *   const guard = await checkSpendLimit("openai");
 *   if (guard) return guard; // returns 429 NextResponse
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export type SpendProvider = "openai" | "fal" | "higgsfield" | "elevenlabs";

// Hard monthly limits — override with env vars
const DEFAULT_LIMITS: Record<SpendProvider, number> = {
  openai: 300,
  fal: 150,
  higgsfield: 60,
  elevenlabs: 200,
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
 * Check if provider is under its monthly limit, then increment the counter.
 * Returns null (allowed) or a NextResponse 429 (blocked).
 */
export async function checkSpendLimit(provider: SpendProvider): Promise<NextResponse | null> {
  const limit = getLimit(provider);
  const month = currentMonth();

  const supabase = getSupabase();
  if (!supabase) {
    // No Supabase → can't track, allow through but log a warning
    console.warn(`[spend-guard] Supabase not configured — ${provider} call unchecked`);
    return null;
  }

  try {
    // Upsert: increment call_count, return new value
    const { data, error } = await supabase.rpc("increment_api_usage", {
      p_provider: provider,
      p_month: month,
    });

    if (error) {
      // If the RPC doesn't exist yet, fail open (don't block legitimate calls)
      console.error(`[spend-guard] RPC error for ${provider}:`, error.message);
      return null;
    }

    const newCount = typeof data === "number" ? data : 0;
    console.log(`[spend-guard] ${provider} ${month}: ${newCount}/${limit}`);

    if (newCount > limit) {
      console.warn(`[spend-guard] BLOCKED ${provider} — ${newCount} calls exceeds limit ${limit}`);
      return new NextResponse(
        JSON.stringify({
          error: `Monthly API limit reached for ${provider} (${limit} calls). Resets next month.`,
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
  { provider: string; month: string; call_count: number; limit: number }[]
> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const month = currentMonth();
  const { data, error } = await supabase
    .from("api_monthly_usage")
    .select("provider, month, call_count")
    .eq("month", month);

  if (error || !data) return [];

  return data.map((row) => ({
    provider: row.provider as string,
    month: row.month as string,
    call_count: row.call_count as number,
    limit: getLimit(row.provider as SpendProvider),
  }));
}
