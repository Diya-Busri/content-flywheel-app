import { NextResponse } from "next/server";

/**
 * Per-user rate limit for OpenAI and ElevenLabs API routes.
 * Two limits are enforced:
 *  - 20 requests per minute (rolling window) — burst protection
 *  - 150 requests per day (rolling 24h window) — daily budget cap
 *
 * Uses in-memory store; for multi-instance deploy consider Redis/Vercel KV.
 * Adjust DAILY_LIMIT to control spend — each unit roughly corresponds to one
 * AI generation (script, image, voiceover clip, etc.).
 */

const WINDOW_MS = 60 * 1000;       // 1 minute
const MAX_PER_MINUTE = 20;

const DAY_MS = 24 * 60 * 60 * 1000; // 24 hours
const DAILY_LIMIT = 150;             // adjust down to cut costs further

/** userId -> timestamps of requests within the rolling 24h window */
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
 * Check if the user is over the AI rate limit.
 * Enforces both per-minute burst and 24h daily cap.
 * @param userId Clerk user ID (or null if unauthenticated)
 * @returns NextResponse with 429 if over limit, or null if allowed
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
