/**
 * Shared CTA / intro / outro timing + voiceover copy for viral Quiz / Would You Rather export + preview.
 */

export const VIRAL_CTA_VOICE_QUIZ =
  "Enjoyed this? Follow for more quizzes like this. Comment your score below. Like, share, and follow for more.";

export const VIRAL_CTA_VOICE_WYR =
  "Enjoyed this? Follow for more. Like, share, and comment your pick below!";

export function getCtaVoiceSnippet(contentType: "quiz" | "would-you-rather"): string {
  return contentType === "quiz" ? VIRAL_CTA_VOICE_QUIZ : VIRAL_CTA_VOICE_WYR;
}

export function getIntroVoiceSnippet(type: "quiz" | "would-you-rather", topic: string): string {
  const t = (topic || "this topic").trim();
  if (type === "quiz") {
    return `Welcome! You're watching a trivia quiz on ${t}. Get ready — first question coming up.`;
  }
  return `Welcome! Would You Rather — all about ${t}. Here we go!`;
}

export function getOutroVoiceSnippet(type: "quiz" | "would-you-rather"): string {
  return type === "quiz"
    ? "That's the quiz! Thanks for playing. Follow for more like this, drop your score in the comments, like and share."
    : "That's a wrap! Thanks for watching. Follow for more, like and share, and comment your picks below.";
}

export type ViralTimelineItem =
  | { kind: "intro" }
  | { kind: "round"; roundIndex: number }
  | { kind: "cta"; placement: "mid" }
  | { kind: "outro" };

/**
 * Intro → rounds → optional mid CTAs every `ctaEvery` rounds → outro.
 */
export function buildViralTimeline(roundCount: number, ctaEvery: number = 4): ViralTimelineItem[] {
  const items: ViralTimelineItem[] = [{ kind: "intro" }];
  if (roundCount <= 0) {
    items.push({ kind: "outro" });
    return items;
  }
  for (let i = 0; i < roundCount; i++) {
    items.push({ kind: "round", roundIndex: i });
    const completedQ = i + 1;
    if (ctaEvery > 0 && completedQ % ctaEvery === 0 && i < roundCount - 1) {
      items.push({ kind: "cta", placement: "mid" });
    }
  }
  items.push({ kind: "outro" });
  return items;
}

export function timelineIndexForRound(timeline: ViralTimelineItem[], roundIndex: number): number {
  const idx = timeline.findIndex((x) => x.kind === "round" && x.roundIndex === roundIndex);
  return idx >= 0 ? idx : 0;
}

type ExportRound = {
  optionA?: string;
  optionB?: string;
  question?: string;
  options?: string[];
};

/** Voiceover lines in timeline order, for ElevenLabs export. */
export function buildViralExportVoiceScript(
  type: "quiz" | "would-you-rather",
  topic: string,
  rounds: ExportRound[],
  timeline: ViralTimelineItem[]
): string {
  const parts: string[] = [];
  for (const item of timeline) {
    if (item.kind === "intro") {
      parts.push(getIntroVoiceSnippet(type, topic));
      continue;
    }
    if (item.kind === "outro") {
      parts.push(getOutroVoiceSnippet(type));
      continue;
    }
    if (item.kind === "cta") {
      parts.push(getCtaVoiceSnippet(type));
      continue;
    }
    const i = item.roundIndex;
    const r = rounds[i];
    if (!r) continue;
    if (type === "would-you-rather") {
      parts.push(
        `Round ${i + 1}. Would you rather: ${r.optionA ?? ""}... or ${r.optionB ?? ""}? Comment A or B below!`
      );
    } else {
      const optLabels = ["A", "B", "C", "D"];
      const optText = (r.options ?? []).map((o, oi) => `${optLabels[oi]}: ${o}`).join(", ");
      parts.push(`Question ${i + 1}: ${r.question ?? ""}. Options: ${optText}.`);
    }
  }
  return parts.join(" ");
}
