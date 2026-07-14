/**
 * Achievements for CONFIRMED UNDERSTANDING — a separate track from
 * LessonComplete.tsx's ACHIEVEMENT_THRESHOLDS (which counts lesson
 * completions). This counts, per course, how many lessons a learner has
 * actually confirmed ("Yes, I understand") rather than just marked complete —
 * a genuinely different signal a learner can be proud of.
 */
export interface UnderstandingAchievement {
  icon: string;
  label: string;
}

export const UNDERSTANDING_ACHIEVEMENT_THRESHOLDS: Record<number, UnderstandingAchievement> = {
  1: { icon: "🧠", label: "First Understanding — you confirmed you truly understood a lesson!" },
  5: { icon: "💡", label: "Sharp Learner — 5 lessons understood!" },
  10: { icon: "🎓", label: "Deep Diver — 10 lessons understood!" },
  25: { icon: "🌟", label: "Master Learner — 25 lessons understood!" },
};

/** Returns the achievement unlocked at exactly this count, or null if this count isn't a threshold. */
export function getUnlockedUnderstandingAchievement(count: number): UnderstandingAchievement | null {
  return UNDERSTANDING_ACHIEVEMENT_THRESHOLDS[count] ?? null;
}
