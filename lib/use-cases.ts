/**
 * User-selectable use cases that control which sidebar features are visible.
 * Each use case maps to the featureKey values used in the sidebar.
 */
export type UseCase = {
  id: string;
  label: string;
  description: string;
  emoji: string;
  featureKeys: string[];
};

export const USE_CASES: UseCase[] = [
  {
    id: "videos",
    label: "Create Videos",
    description: "TikTok, YouTube Shorts, Reels & AI avatars",
    emoji: "🎬",
    featureKeys: [
      "ai_coach",
      "template_studio",
      "video_timeline",
      "video_credits",
      "my_library",
      "content_calendar",
      "script_checker",
    ],
  },
  {
    id: "digital_products",
    label: "Sell Digital Products",
    description: "eBooks, guides, planners & templates",
    emoji: "📦",
    featureKeys: ["digital_products"],
  },
  {
    id: "email_marketing",
    label: "Email Marketing",
    description: "Build and email your subscriber list",
    emoji: "📧",
    featureKeys: ["email_marketing"],
  },
  {
    id: "tiktok_shop",
    label: "TikTok Shop",
    description: "Product review videos for TikTok Shop",
    emoji: "🛍️",
    featureKeys: ["tiktok_shop"],
  },
  {
    id: "goals",
    label: "Track Goals",
    description: "Set revenue and content milestones",
    emoji: "🎯",
    featureKeys: ["goal_tracker", "invite_creators"],
  },
];

/** All feature keys that can be hidden by use-case preferences */
const ALL_PREFERENCE_KEYS = USE_CASES.flatMap((uc) => uc.featureKeys);

/**
 * Given a user's selected use cases, returns which feature keys should be hidden.
 * If selectedUseCases is null/empty, nothing is hidden (show everything).
 */
export function getHiddenFeaturesByUseCases(selectedUseCases: string[] | null): string[] {
  if (!selectedUseCases || selectedUseCases.length === 0) return [];

  const visibleKeys = new Set(
    USE_CASES.filter((uc) => selectedUseCases.includes(uc.id)).flatMap((uc) => uc.featureKeys)
  );

  return ALL_PREFERENCE_KEYS.filter((key) => !visibleKeys.has(key));
}
