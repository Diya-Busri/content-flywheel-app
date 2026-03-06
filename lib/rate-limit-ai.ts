import { NextResponse } from "next/server";

/**
 * Per-user rate limit for OpenAI and ElevenLabs API routes.
 * Max 20 requests per user per minute (rolling window).
 * Uses in-memory store; for multi-instance deploy consider Redis/Vercel KV.
 */

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 20;

/** userId -> timestamps of requests in the current window */
const store = new Map<string, number[]>();

function prune(userId: string): void {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const timestamps = store.get(userId);
  if (!timestamps) return;
  const kept = timestamps.filter((t) => t > cutoff);
  if (kept.length === 0) store.delete(userId);
  else store.set(userId, kept);
}

/**
 * Check if the user is over the AI rate limit (20 req/min).
 * Call this at the start of any API route that uses OpenAI or ElevenLabs.
 * @param userId Clerk user ID (or null if unauthenticated)
 * @returns NextResponse with 429 if over limit, or null if allowed
 */
export function checkAiRateLimit(userId: string | null): NextResponse | null {
  if (!userId) return null; // let auth handle unauthenticated
  prune(userId);
  const timestamps = store.get(userId) ?? [];
  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return new NextResponse(
      JSON.stringify({
        error: "Rate limit exceeded. Maximum 20 AI requests per minute. Please try again later.",
      }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }
  timestamps.push(Date.now());
  store.set(userId, timestamps);
  return null;
}
