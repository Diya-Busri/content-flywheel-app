/**
 * Trust Score Configuration
 * ─────────────────────────
 * All weights, thresholds, levels, and factor metadata live here.
 * Change weights without touching computation logic.
 */

// ─── Factor weights (must sum to 100) ────────────────────────────────────────

export const TRUST_SCORE_WEIGHTS: Record<string, number> = {
  verifiedSales:       20,  // Completed, non-refunded product orders
  avgRating:           20,  // Average star rating from product reviews
  reviewCount:         10,  // Volume of verified reviews
  refundRate:          15,  // Lower refund rate = higher score
  productCompleteness: 10,  // How complete each product listing is
  profileCompleteness: 10,  // Store profile: image, bio, banner, social links
  followerGrowth:       5,  // Follower count, log-normalised
  accountAge:           5,  // Days active, capped at 365
  communityScore:       3,  // Academy / challenge participation (0–100 placeholder)
  responseTime:         2,  // Placeholder — will use messaging stats when available
};

// ─── Trust Score levels ───────────────────────────────────────────────────────

export type TrustLevel = "building" | "developing" | "trusted" | "excellent" | "elite";

export const TRUST_LEVELS: Array<{
  id: TrustLevel;
  label: string;
  emoji: string;
  minScore: number;
  maxScore: number;
  color: string;
  tagline: string;
}> = [
  { id: "building",   label: "New / Building Trust", emoji: "🌱", minScore: 0,  maxScore: 39,  color: "#6b7280", tagline: "Just getting started — keep growing" },
  { id: "developing", label: "Developing",            emoji: "📈", minScore: 40, maxScore: 59,  color: "#f59e0b", tagline: "Building a solid reputation" },
  { id: "trusted",    label: "Trusted",               emoji: "✅", minScore: 60, maxScore: 79,  color: "#3b82f6", tagline: "Buyers can rely on this creator" },
  { id: "excellent",  label: "Excellent",             emoji: "⭐", minScore: 80, maxScore: 94,  color: "#8b5cf6", tagline: "Consistently delivering great value" },
  { id: "elite",      label: "Elite",                 emoji: "💎", minScore: 95, maxScore: 100, color: "#f97316", tagline: "Top-tier creator — highest trust" },
];

export function getTrustLevel(score: number): typeof TRUST_LEVELS[number] {
  return TRUST_LEVELS.find((l) => score >= l.minScore && score <= l.maxScore) ?? TRUST_LEVELS[0];
}

// ─── Factor metadata (for UI display) ────────────────────────────────────────

export const TRUST_FACTOR_META: Record<string, {
  label: string;
  icon: string;
  description: string;
  tip: string;
}> = {
  verifiedSales: {
    label: "Sales Reliability",
    icon: "🛒",
    description: "Verified purchases from real buyers — not refunded or disputed.",
    tip: "Publish more products and promote them to increase verified sales.",
  },
  avgRating: {
    label: "Customer Reviews",
    icon: "⭐",
    description: "Average star rating across all your products from verified buyers.",
    tip: "Deliver excellent products and ask buyers to leave reviews.",
  },
  reviewCount: {
    label: "Review Volume",
    icon: "💬",
    description: "The number of verified reviews you've received — more reviews build confidence.",
    tip: "Request reviews from buyers after every sale.",
  },
  refundRate: {
    label: "Refund Rate",
    icon: "🔄",
    description: "Percentage of sales that were refunded. Lower is better.",
    tip: "Set clear product expectations and deliver on your promises to minimise refunds.",
  },
  productCompleteness: {
    label: "Product Quality",
    icon: "📦",
    description: "How complete your product listings are — cover image, description, preview, price.",
    tip: "Add cover images, detailed descriptions, and preview pages to all products.",
  },
  profileCompleteness: {
    label: "Store Completeness",
    icon: "🏪",
    description: "How complete your creator store is — profile photo, bio, banner, social links.",
    tip: "Complete your store profile: add a photo, bio, banner, and social links.",
  },
  followerGrowth: {
    label: "Follower Growth",
    icon: "👥",
    description: "Your follower base — a larger following signals an engaged creator community.",
    tip: "Share your store link and create free value to grow your following.",
  },
  accountAge: {
    label: "Selling History",
    icon: "📅",
    description: "Time active on Content Flywheel — longer history = more established.",
    tip: "Keep publishing — your Trust Score grows naturally with time.",
  },
  communityScore: {
    label: "Community Reputation",
    icon: "🤝",
    description: "Your participation in creator challenges, academy, and platform activities.",
    tip: "Join creator challenges and complete academy courses to boost this.",
  },
  responseTime: {
    label: "Response Time",
    icon: "⚡",
    description: "How quickly you respond to buyer messages and inquiries.",
    tip: "Respond to messages quickly to show buyers you're active and supportive.",
  },
};

// ─── Normalisation caps (for diminishing returns) ────────────────────────────

export const TRUST_CAPS = {
  /** Sales count at which verifiedSales score is ~100 (log-normalised). */
  SALES_LOG_BASE: 200,
  /** Review count at which reviewCount score is ~100 (log-normalised). */
  REVIEWS_LOG_BASE: 50,
  /** Follower count at which followerGrowth score is ~100 (log-normalised). */
  FOLLOWERS_LOG_BASE: 1000,
  /** Account age (days) for full accountAge score. */
  ACCOUNT_AGE_DAYS: 365,
};

// ─── Abuse protection thresholds ─────────────────────────────────────────────

export const TRUST_ABUSE = {
  /** Refund rate above this percentage triggers a penalty flag. */
  HIGH_REFUND_RATE_PCT: 25,
  /** Minimum review count before avgRating is counted in full. */
  MIN_REVIEWS_FOR_RATING: 3,
};
