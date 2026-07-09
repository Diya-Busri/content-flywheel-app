/**
 * Maps a video guide script (hook, body, CTA) to scene text overlay exactText values.
 * - Scene 1 → hook
 * - Scenes 2 to n-1 → body sentences (distributed)
 * - Last scene → CTA
 * Used when the script is regenerated/shortened/lengthened so overlays stay in sync and can be saved to the DB.
 */
export function mapScriptToSceneOverlays(
  script: { hook: string; body: string; cta: string },
  sceneCount: number
): string[] {
  if (sceneCount <= 0) return [];
  const hook = (script.hook ?? "").trim();
  const body = (script.body ?? "").trim();
  const cta = (script.cta ?? "").trim();

  if (sceneCount === 1) {
    return [([hook, body, cta].filter(Boolean).join(" ") || "").trim()];
  }
  if (sceneCount === 2) {
    return [hook || "", (body && cta ? `${body} ${cta}` : body || cta).trim()];
  }

  const chunks: string[] = Array(sceneCount).fill("");
  chunks[0] = hook;
  chunks[sceneCount - 1] = cta;

  const middleCount = sceneCount - 2;
  if (middleCount <= 0) return chunks;

  const sentences = body
    ? body.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
    : [];
  const bodyParts = sentences.length > 0 ? sentences : (body ? [body] : []);

  if (bodyParts.length > 0) {
    const perSlot = Math.max(1, Math.ceil(bodyParts.length / middleCount));
    for (let i = 0; i < middleCount; i++) {
      const start = i * perSlot;
      const end = i === middleCount - 1 ? bodyParts.length : Math.min(start + perSlot, bodyParts.length);
      chunks[1 + i] = bodyParts.slice(start, end).join(" ").trim();
    }
  } else {
    chunks[1] = body;
  }

  return chunks;
}
