/**
 * Exponential backoff retry for OpenAI (and similar) API calls on 429 rate limit.
 * Waits 5s, 10s, 20s (up to 3 retries) before failing.
 */

const RETRY_DELAYS_MS = [5000, 10000, 20000];
const MAX_RETRIES = 3;

export function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

/**
 * Run an async function; on 429 or 5xx, retry with exponential backoff up to MAX_RETRIES.
 * For Response results: retries when status is 429 or 5xx; returns last response after retries exhausted.
 */
export async function withRetry429<T>(
  fn: () => Promise<T>,
  options?: {
    isRetryable?: (result: T) => boolean;
    onRetry?: (attempt: number, delayMs: number) => void;
  }
): Promise<T> {
  let lastResult: T;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      lastResult = await fn();
      const retryable = options?.isRetryable
        ? options.isRetryable(lastResult)
        : (lastResult as unknown as Response)?.status != null && isRetryableStatus((lastResult as unknown as Response).status);
      if (attempt < MAX_RETRIES && retryable) {
        const delayMs = RETRY_DELAYS_MS[attempt] ?? 20000;
        options?.onRetry?.(attempt + 1, delayMs);
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      return lastResult;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const status = (err as { status?: number })?.status;
      const is429 =
        status === 429 || msg.includes("429") || msg.includes("rate limit") || ((status ?? 0) >= 500 && (status ?? 0) < 600);
      if (attempt < MAX_RETRIES && is429) {
        const delayMs = RETRY_DELAYS_MS[attempt] ?? 20000;
        options?.onRetry?.(attempt + 1, delayMs);
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw err;
    }
  }
  return lastResult!;
}

/**
 * Fetch OpenAI API with retry on 429/5xx. Returns the response (possibly 429 after retries).
 */
export async function fetchOpenAIWithRetry(
  url: string,
  init: RequestInit,
  options?: { onRetry?: (attempt: number, delayMs: number) => void }
): Promise<Response> {
  return withRetry429(
    async () => fetch(url, init),
    {
      isRetryable: (r) => r.status === 429 || (r.status >= 500 && r.status < 600),
      onRetry: options?.onRetry,
    }
  );
}
