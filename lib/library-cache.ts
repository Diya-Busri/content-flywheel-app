/**
 * Server-side in-memory cache for /api/library responses.
 * Entries expire after 60 seconds so data stays reasonably fresh.
 * Call bustLibraryCache(userId) after any write (delete, restore, duplicate).
 */

const CACHE_TTL_MS = 60_000;

type CacheEntry = { data: unknown[]; expiresAt: number };
const cache = new Map<string, CacheEntry>();

export function getLibraryCached(key: string): unknown[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setLibraryCache(key: string, data: unknown[]): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function bustLibraryCache(userId: string): void {
  const keys = Array.from(cache.keys());
  for (const key of keys) {
    if (key.startsWith(`${userId}:`)) cache.delete(key);
  }
}
