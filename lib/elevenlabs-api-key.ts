/**
 * Reads ELEVENLABS_API_KEY from environment.
 * Use this in API routes so the key is normalized (trimmed, no newlines, no surrounding quotes).
 * Set in .env.local (local) and Vercel Environment Variables (production). Restart dev server / redeploy after changing.
 * Variable name must be exactly: ELEVENLABS_API_KEY
 */
export function getElevenLabsApiKey(): string | null {
  const raw = process.env.ELEVENLABS_API_KEY;
  if (raw == null || typeof raw !== "string") return null;
  let key = raw.replace(/\r\n?|\n/g, "").trim();
  if (key.length >= 2 && ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'")))) {
    key = key.slice(1, -1).trim();
  }
  return key.length > 0 ? key : null;
}
