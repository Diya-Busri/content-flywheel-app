/**
 * In-memory store for temporary voiceover audio when Supabase is unreachable.
 * Entries expire after 10 minutes so Creatomate can fetch the URL during render.
 */

const TTL_MS = 10 * 60 * 1000; // 10 minutes

const store = new Map<
  string,
  { buffer: Buffer; contentType: string; createdAt: number }
>();

function cleanup() {
  const now = Date.now();
  for (const [token, entry] of Array.from(store.entries())) {
    if (now - entry.createdAt > TTL_MS) store.delete(token);
  }
}

export function putTemporaryAudio(buffer: Buffer, contentType = "audio/mpeg"): string {
  cleanup();
  const token =
    "t-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  store.set(token, { buffer, contentType, createdAt: Date.now() });
  return token;
}

export function getTemporaryAudio(
  token: string
): { buffer: Buffer; contentType: string } | null {
  const entry = store.get(token);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(token);
    return null;
  }
  return { buffer: entry.buffer, contentType: entry.contentType };
}
