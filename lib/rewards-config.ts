/**
 * Creator Rewards — rule constants.
 * Adjust these values to change earning rates without touching logic.
 */

export const REWARDS_CONFIG = {
  /** Credits earned per referred creator who converts to a paid Pro plan. */
  REFERRAL_CONVERSION_CREDIT: 1.0,

  /** Number of verified sales required to earn one credit. */
  SALES_PER_CREDIT: 10,
  /** Credits earned per sales milestone. */
  SALES_CREDIT: 1.0,

  /** GBP revenue required to earn one credit. */
  REVENUE_PER_CREDIT_GBP: 100,
  /** Credits earned per revenue milestone. */
  REVENUE_CREDIT: 1.0,

  /** Credits earned for winning Product of the Week (admin-awarded). */
  PRODUCT_OF_WEEK_CREDIT: 2.0,

  /** Number of 5-star reviews required to earn one credit. */
  REVIEWS_PER_CREDIT: 25,
  /** Credits earned per review milestone. */
  REVIEW_CREDIT: 1.0,

  /** Credits earned for completing creator profile (one-time). */
  PROFILE_COMPLETE_CREDIT: 0.25,

  /** Credits earned for completing a community challenge. */
  CHALLENGE_CREDIT: 0.5,

  /** Credits spent per featured product slot. */
  FEATURE_COST_CREDITS: 1.0,

  /** How many days a featured slot lasts. */
  FEATURE_DURATION_DAYS: 7,

  /** Maximum simultaneous featured products per creator (admin can override). */
  MAX_FEATURED_PRODUCTS: 1,
} as const;

/** Creator level thresholds (inclusive lower bound, exclusive upper bound). */
export const CREATOR_LEVELS = [
  { id: "new",    label: "New Creator",     emoji: "🌱", minSales: 0,   maxSales: 5   },
  { id: "rising", label: "Rising Creator",  emoji: "🚀", minSales: 5,   maxSales: 50  },
  { id: "pro",    label: "Pro Creator",     emoji: "⭐", minSales: 50,  maxSales: 250 },
  { id: "elite",  label: "Elite Creator",   emoji: "💎", minSales: 250, maxSales: Infinity },
] as const;

export type CreatorLevelId = (typeof CREATOR_LEVELS)[number]["id"];

export function getCreatorLevel(salesCount: number): (typeof CREATOR_LEVELS)[number] {
  return (
    [...CREATOR_LEVELS].reverse().find((l) => salesCount >= l.minSales) ?? CREATOR_LEVELS[0]
  );
}

/**
 * Reputation score formula — weights add up to 100.
 * Each signal is normalised to 0–1 then multiplied by its weight.
 */
export const SCORE_WEIGHTS = {
  salesCount:      20, // normalised against 500 sales = max
  avgRating:       25, // 5.0 = max
  reviewCount:     10, // normalised against 50 reviews = max
  revenueGbp:      20, // normalised against £5000 = max
  followerGrowth:  10, // normalised against 500 followers = max
  productQuality:  10, // 0–10 product completeness score, /10
  communityScore:   5, // participation placeholder (always 0 unless set manually)
} as const;
