import { NextResponse } from "next/server";

/**
 * Rate limit for ALL API routes: 20 requests per minute per user (or per IP when unauthenticated).
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set;
 * otherwise falls back to in-memory (single-instance only).
 * Call at the top of every API route handler.
 */

const LIMIT = 20;
const WINDOW_SEC = 60;

/** In-memory fallback when Upstash is not configured */
const memoryStore = new Map<string, number[]>();

function memoryPrune(key: string): void {
  const now = Date.now();
  const cutoff = now - WINDOW_SEC * 1000;
  const timestamps = memoryStore.get(key) ?? [];
  const kept = timestamps.filter((t) => t > cutoff);
  if (kept.length === 0) memoryStore.delete(key);
  else memoryStore.set(key, kept);
}

function memoryCheck(key: string): boolean {
  memoryPrune(key);
  const timestamps = memoryStore.get(key) ?? [];
  if (timestamps.length >= LIMIT) return false;
  timestamps.push(Date.now());
  memoryStore.set(key, timestamps);
  return true;
}

function rateLimitResponse(message = "Rate limit exceeded. Maximum 20 requests per minute. Try again later."): NextResponse {
  return new NextResponse(
    JSON.stringify({ error: message }),
    { status: 429, headers: { "Content-Type": "application/json" } }
  );
}

/**
 * Check API rate limit. Call at the start of every API route.
 * @param identifier - Preferred: Clerk userId; fallback: IP or "anon"
 * @returns NextResponse (429) if over limit, else null
 */
export async function checkApiRateLimit(identifier: string | null): Promise<NextResponse | null> {
  const key = identifier && identifier.trim() ? `user:${identifier.trim()}` : "anon";

  try {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (url && token) {
      const { Ratelimit } = await import("@upstash/ratelimit");
      const { Redis } = await import("@upstash/redis");
      const redis = new Redis({ url, token });
      const ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(LIMIT, `${WINDOW_SEC} s`),
      });
      const { success } = await ratelimit.limit(key);
      if (!success) return rateLimitResponse();
      return null;
    }
  } catch (e) {
    console.warn("[rate-limit-api] Upstash error, using memory fallback:", e);
  }

  if (!memoryCheck(key)) return rateLimitResponse();
  return null;
}

/**
 * Get client IP from request (for use when user is not authenticated).
 */
export function getClientIp(request: Request | null): string | null {
  if (!request) return null;
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? null;
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}
