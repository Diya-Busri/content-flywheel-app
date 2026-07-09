import { NextResponse } from "next/server";

/**
 * Per-user rate limit for OpenAI and ElevenLabs API routes.
 * Two limits are enforced:
 *  - 20 requests per minute (rolling window) — burst protection
 *  - 150 requests per day (rolling 24h window) — daily budget cap
 *
 * ENFORCEMENT: Uses in-memory store for the synchronous check (keeps all 100+
 * callers working without `await`). On Vercel with multiple instances, each
 * instance enforces its own window — effective limit is MAX_PER_MINUTE × N
 * instances. For burst protection at beta scale (≤100 users) this is acceptable.
 *
 * COST GUARD: checkSpendLimit() in lib/spend-guard.ts uses Supabase (shared
 * across all instances) and is the real cost ceiling. This file is burst
 * protection only.
 *
 * UPGRADE PATH: When you need shared rate limits across instances, add Upstash
 * env vars (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN) and switch
 * callers to the async checkAiRateLimitAsync() exported below.
 */

const WINDOW_MS = 60 * 1000;       // 1 minute
const MAX_PER_MINUTE = 20;

const DAY_MS = 24 * 60 * 60 * 1000; // 24 hours
const DAILY_LIMIT = 150;             // adjust down to cut costs further

/** userId -> timestamps of requests in the rolling 24h window */
const store = new Map<string, number[]>();

function prune(userId: string, windowMs: number): number[] {
  const now = Date.now();
  const cutoff = now - windowMs;
  const timestamps = store.get(userId) ?? [];
  const kept = timestamps.filter((t) => t > cutoff);
  if (kept.length === 0) store.delete(userId);
  else store.set(userId, kept);
  return kept;
}

/**
 * Synchronous check (in-memory). Used by all existing callers.
 * Returns NextResponse(429) if over limit, null if allowed.
 */
export function checkAiRateLimit(userId: string | null): NextResponse | null {
  if (!userId) return null; // let auth handle unauthenticated

  // Check per-minute burst limit
  const recentMinute = prune(userId, WINDOW_MS);
  if (recentMinute.length >= MAX_PER_MINUTE) {
    return new NextResponse(
      JSON.stringify({
        error: "Rate limit exceeded. Maximum 20 AI requests per minute. Please try again in a moment.",
      }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  // Check daily cap
  const recentDay = prune(userId, DAY_MS);
  if (recentDay.length >= DAILY_LIMIT) {
    return new NextResponse(
      JSON.stringify({
        error: `Daily AI limit reached (${DAILY_LIMIT} requests). This resets every 24 hours to keep API costs manageable.`,
      }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  // Record this request
  const now = Date.now();
  const all = store.get(userId) ?? [];
  all.push(now);
  store.set(userId, all);
  return null;
}

/**
 * Async version using Upstash Redis when configured.
 * Shared across all Vercel instances — use for new high-cost routes.
 * Falls back to in-memory if Upstash is not configured.
 *
 * Usage (in async route handlers):
 *   const rl = await checkAiRateLimitAsync(userId);
 *   if (rl) return rl;
 */
export async function checkAiRateLimitAsync(userId: string | null): Promise<NextResponse | null> {
  if (!userId) return null;

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (upstashUrl && upstashToken) {
    try {
      const { Ratelimit } = await import("@upstash/ratelimit");
      const { Redis } = await import("@upstash/redis");
      const redis = new Redis({ url: upstashUrl, token: upstashToken });

      const minuteLimiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(MAX_PER_MINUTE, "60 s"),
        prefix: "ai_min",
      });
      const { success: minOk } = await minuteLimiter.limit(userId);
      if (!minOk) {
        return new NextResponse(
          JSON.stringify({ error: "Rate limit exceeded. Maximum 20 AI requests per minute. Please try again in a moment." }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
      }

      const dayLimiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(DAILY_LIMIT, `${24 * 60 * 60} s`),
        prefix: "ai_day",
      });
      const { success: dayOk } = await dayLimiter.limit(userId);
      if (!dayOk) {
        return new NextResponse(
          JSON.stringify({ error: `Daily AI limit reached (${DAILY_LIMIT} requests). Resets every 24 hours.` }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
      }

      return null;
    } catch (err) {
      console.warn("[rate-limit-ai] Upstash error, falling back to memory:", err);
    }
  }

  // Fallback to in-memory
  return checkAiRateLimit(userId);
}
