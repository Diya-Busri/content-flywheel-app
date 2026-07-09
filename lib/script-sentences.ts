/**
 * Single source of truth for splitting script text by sentence boundaries and
 * distributing complete sentences across scenes. Used by scene cards (SCRIPT label),
 * captions track, and paste-script — never cut mid-sentence.
 */

/** Split after . ? ! or … (ellipsis ... ends with . so matches [.!?]). Never cut mid-sentence. */
const SENTENCE_END_REGEX = /(?<=[.!?])\s+/;

/**
 * Split script text into sentences. Splits after . ? ! (and ellipsis ...).
 * Keeps punctuation with the sentence. No mid-sentence cuts.
 */
export function splitIntoSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(SENTENCE_END_REGEX);
  return parts.map((s) => s.trim()).filter(Boolean);
}

export type SceneTiming = { startSec: number; endSec: number };

/**
 * Distribute complete sentences across scenes by clip duration ratio.
 * Last scene gets any remaining sentences. Returns one string per scene (same length as timings).
 */
export function distributeSentencesToScenes(
  sentences: string[],
  timings: SceneTiming[]
): string[] {
  const n = timings.length;
  if (n === 0 || sentences.length === 0) return Array(n).fill("");

  const totalDuration = timings.reduce(
    (sum, t) => sum + Math.max(0, t.endSec - t.startSec),
    0
  );

  if (totalDuration <= 0) {
    const equalCount = Math.max(1, Math.floor(sentences.length / n));
    const chunks: string[] = [];
    let offset = 0;
    for (let i = 0; i < n; i++) {
      const isLast = i === n - 1;
      const count = isLast
        ? sentences.length - offset
        : Math.min(equalCount, sentences.length - offset);
      chunks.push(sentences.slice(offset, offset + count).join(" ").trim());
      offset += count;
    }
    return chunks;
  }

  const sentenceCount = sentences.length;
  const sentenceFractionPerSec = sentenceCount / totalDuration;
  const chunks: string[] = [];
  let sentenceOffset = 0;

  for (let i = 0; i < n; i++) {
    const { startSec, endSec } = timings[i];
    const duration = Math.max(0, endSec - startSec);
    const countForScene = Math.max(
      0,
      Math.round(sentenceFractionPerSec * duration)
    );
    const isLast = i === n - 1;
    const take = isLast
      ? Math.max(countForScene, sentenceCount - sentenceOffset)
      : countForScene;
    const chunk = sentences
      .slice(sentenceOffset, sentenceOffset + take)
      .join(" ")
      .trim();
    sentenceOffset += take;
    chunks.push(chunk);
  }

  if (sentenceOffset < sentenceCount && chunks.length > 0) {
    const last = chunks[chunks.length - 1];
    const remainder = sentences.slice(sentenceOffset).join(" ").trim();
    chunks[chunks.length - 1] = last
      ? `${last} ${remainder}`.trim()
      : remainder;
  }

  return chunks;
}

/**
 * Build full script from hook, body, CTA (single space between). Use this before splitting.
 */
export function combineFullScript(parts: {
  hook?: string;
  body?: string;
  cta?: string;
}): string {
  const hook = (parts.hook ?? "").trim();
  const body = (parts.body ?? "").trim();
  const cta = (parts.cta ?? "").trim();
  return [hook, body, cta].filter(Boolean).join(" ");
}
