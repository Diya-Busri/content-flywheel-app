/**
 * Reads ELEVENLABS_API_KEY from environment.
 * Use this in API routes so the key is normalized (trimmed, no accidental newlines from copy-paste).
 * Set in .env.local (local) and Vercel Environment Variables (production). Restart dev server / redeploy after changing.
 */
export function getElevenLabsApiKey(): string | null {
  const raw = process.env.ELEVENLABS_API_KEY;
  if (raw == null) return null;
  const key = raw.replace(/\r\n?|\n/g, "").trim();
  return key.length > 0 ? key : null;
}
