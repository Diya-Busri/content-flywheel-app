/**
 * AI Story: lock per-character visual identity across scenes (Template Studio).
 */

/** Prepended to scene image prompts when no per-character registry is used. */
export const AI_STORY_GLOBAL_VISUAL_STYLE =
  "3D animated Pixar-style fruit characters with big expressive eyes, rounded cartoonish bodies, consistent art style across all scenes.";

export function parseCharacterTypes(characters: string): string[] {
  return characters
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function buildNameToTypeMap(characterNames: string, types: string[]): Map<string, string> {
  const map = new Map<string, string>();
  const names = characterNames
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const n = Math.min(names.length, types.length);
  for (let i = 0; i < n; i++) map.set(names[i], types[i]);
  return map;
}

export function resolveSpeakerToType(
  speaker: string,
  types: string[],
  nameToType: Map<string, string>
): string | null {
  const trimmed = speaker.trim();
  if (nameToType.has(trimmed)) return nameToType.get(trimmed)!;
  const lower = trimmed.toLowerCase();
  let best: string | null = null;
  let bestLen = 0;
  for (const t of types) {
    const tl = t.toLowerCase();
    if (lower.includes(tl) && t.length >= bestLen) {
      best = t;
      bestLen = t.length;
    }
  }
  return best;
}

/** Which character types speak in this scene (from "Name: line" dialogue). */
export function typesInDialogue(
  dialogue: string,
  types: string[],
  nameToType: Map<string, string>
): string[] {
  const found = new Set<string>();
  for (const line of dialogue.split(/\n/)) {
    const m = line.match(/^([^:]+):/);
    if (!m) continue;
    const t = resolveSpeakerToType(m[1], types, nameToType);
    if (t) found.add(t);
  }
  return Array.from(found);
}

const CHARACTER_LOCK_HEADER =
  "CHARACTER LOCK — Reproduce these character designs EXACTLY in every image: same art style, same eye shape and size, same body proportions, same colors. Do not redesign or vary characters.";

/**
 * Prepend the same locked global + **every** character description on **every** scene (verbatim),
 * then the scene composition. We intentionally do NOT filter by who speaks: dialogue names are
 * often brainrot nicknames that do not contain the type substring (e.g. "Sigma Berry"), which
 * previously dropped all per-character locks.
 */
export function mergeCharacterLocksIntoImagePrompt(
  baseImagePrompt: string,
  registry: Record<string, string>,
  characterTypesOrdered: string[],
  globalStyle: string
): string {
  const parts: string[] = [CHARACTER_LOCK_HEADER];
  if (globalStyle.trim()) parts.push(`Global style: ${globalStyle.trim()}`);
  for (const t of characterTypesOrdered) {
    const desc = registry[t];
    if (desc && String(desc).trim()) {
      parts.push(`${t}: ${String(desc).trim()}`);
    }
  }
  parts.push(`Scene: ${baseImagePrompt.trim()}`);
  return parts.join("\n\n");
}

/**
 * Remove wording that tends to produce sprite sheets / multi-panel grids in image models.
 * Applied to LLM imagePrompt output and to scene img2img requests.
 */
export function sanitizeAiStorySceneImagePrompt(prompt: string): string {
  let s = prompt;
  const patterns: RegExp[] = [
    /\bcharacter\s*sheets?\b/gi,
    /\bsprite\s*sheets?\b/gi,
    /\bpose\s*sheets?\b/gi,
    /\bmodel\s*sheets?\b/gi,
    /\breference\s*sheets?\b/gi,
    /\bcontact\s*sheets?\b/gi,
    /\bexpression\s*sheets?\b/gi,
    /\bturnaround\s*sheets?\b/gi,
    /\bturn[- ]?arounds?\b/gi,
    /\bmultiple\s+poses?\b/gi,
    /\bmultiple\s+angles?\b/gi,
    /\bgrid\s+of\s+/gi,
    /\b(tiled|tile)\s+grid\b/gi,
    /\b(collage|montage)\s+of\b/gi,
    /\bstoryboard(\s+panels?|\s+layout)?\b/gi,
    /\b(comic[- ]?strip|strip\s+of\s+panels?)\b/gi,
    /\b9[- ]?panel\b/gi,
    /\barray\s+of\s+poses?\b/gi,
    /\bsheet\s+showing\b/gi,
  ];
  for (const re of patterns) s = s.replace(re, " ");
  return s.replace(/\s+/g, " ").replace(/\s+,/g, ",").trim();
}
