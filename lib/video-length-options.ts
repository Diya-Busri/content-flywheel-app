/**
 * Shared video length options for script generation and video creation guides.
 * Used by TikTok Shop and Digital Products flows.
 */
export const VIDEO_LENGTH_OPTIONS = [
  {
    seconds: 15,
    label: "15 seconds",
    sublabel: "Quick hook – TikTok/Reels",
    wordRange: "~40–50 words",
    wordsMin: 40,
    wordsMax: 50,
    scenesMin: 3,
    scenesMax: 4,
  },
  {
    seconds: 30,
    label: "30 seconds",
    sublabel: "Standard – most popular",
    wordRange: "~80–100 words",
    wordsMin: 80,
    wordsMax: 100,
    scenesMin: 5,
    scenesMax: 6,
  },
  {
    seconds: 60,
    label: "60 seconds",
    sublabel: "Detailed – product demos",
    wordRange: "~150–200 words",
    wordsMin: 150,
    wordsMax: 200,
    scenesMin: 8,
    scenesMax: 10,
  },
  {
    seconds: 90,
    label: "90 seconds",
    sublabel: "In-depth – reviews/tutorials",
    wordRange: "~250–300 words",
    wordsMin: 250,
    wordsMax: 300,
    scenesMin: 12,
    scenesMax: 15,
  },
] as const;

export type VideoLengthSeconds = (typeof VIDEO_LENGTH_OPTIONS)[number]["seconds"];

export const DEFAULT_VIDEO_LENGTH_SECONDS: VideoLengthSeconds = 30;
/** Alias for compatibility */
export const DEFAULT_VIDEO_LENGTH_SEC = 30;

export function getVideoLengthOption(seconds: number) {
  return VIDEO_LENGTH_OPTIONS.find((o) => o.seconds === seconds) ?? VIDEO_LENGTH_OPTIONS[1];
}

/** Returns option for the given seconds, or default (30s). For API use; includes durationSec, wordsMin, wordsMax, scenesMin, scenesMax. */
export function getVideoLengthOptionOrDefault(seconds: number | undefined) {
  const opt = getVideoLengthOption(
    seconds != null && [15, 30, 60, 90].includes(seconds) ? seconds : DEFAULT_VIDEO_LENGTH_SEC
  );
  return {
    ...opt,
    durationSec: opt.seconds,
    wordsMin: opt.wordsMin,
    wordsMax: opt.wordsMax,
    scenesMin: opt.scenesMin,
    scenesMax: opt.scenesMax,
  };
}
