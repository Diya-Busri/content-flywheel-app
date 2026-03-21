/** Normalize slang / stage directions for TTS (AI Story / Video Guide voiceover). */
export function toSpeakable(text: string) {
  return text
    .replace(/\bfr fr\b/gi, "for real for real")
    .replace(/\bfr\b/gi, "for real")
    .replace(/\bngl\b/gi, "not gonna lie")
    .replace(/\bidk\b/gi, "I don't know")
    .replace(/\bomg\b/gi, "oh my god")
    .replace(/\bnpc\b/gi, "en pee see")
    .replace(/\blol\b/gi, "laughing out loud")
    .replace(/\bimo\b/gi, "in my opinion")
    .replace(/\bbtw\b/gi, "by the way")
    .replace(/\bL \+ ratio\b/gi, "L plus ratio")
    .replace(/\bno cap\b/gi, "no cap")
    .replace(/\bskibidi\b/gi, "ski-biddy")
    .replace(/\bgyatt\b/gi, "gyat")
    .replace(/\basap\b/gi, "as soon as possible")
    .replace(/\*[^*]+\*/g, "")
    .trim();
}
