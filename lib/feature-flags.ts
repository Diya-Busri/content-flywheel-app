import { db } from "@/db/db";
import { featureFlagsTable } from "@/db/schema/feature-flags-schema";
import { eq, or, isNull } from "drizzle-orm";

/**
 * Feature flag keys — must match what you create in the Admin Feature Flags page.
 *
 * Two tiers:
 *  - STABLE: default ON for all users. No flag needed to show them.
 *            Add a flag with enabled=false to hide from users.
 *  - BETA:   default OFF for all users. Must create a flag with enabled=true
 *            to show to users (or a per-user flag for single-user access).
 *            Admins always bypass — they see beta features regardless.
 */
export const FEATURE_KEYS = {
  // ── Stable features (default ON) ─────────────────────────────────────────
  AI_COACH: "ai_coach",
  DESIGN_STUDIO: "design_studio",
  VIDEO_CREDITS: "video_credits",
  MY_LIBRARY: "my_library",
  CONTENT_CALENDAR: "content_calendar",
  SCRIPT_CHECKER: "script_checker",
  DIGITAL_PRODUCTS: "digital_products",
  TIKTOK_SHOP: "tiktok_shop",
  PRINT_ON_DEMAND: "print_on_demand",
  EMAIL_MARKETING: "email_marketing",
  YOUTUBE_UPLOAD: "youtube_upload",
  INVITE_CREATORS: "invite_creators",

  // ── Beta features (default OFF — must be explicitly enabled) ─────────────
  TEMPLATE_STUDIO: "template_studio",
  VIDEO_TIMELINE: "video_timeline",
  GOAL_TRACKER: "goal_tracker",
  DROP_CAMPAIGN: "drop_campaign",
  GROW_HUB: "grow_hub",
  CAPTION_LIBRARY: "caption_library",
  UGC_LAB: "ugc_lab",
  BRAND_BUILDER: "brand_builder",
  CAMPAIGN_MODE: "campaign_mode",
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

/**
 * Beta features are OFF by default for regular users.
 * A flag with enabled=true must exist to show them.
 * Admins are never affected by this — they bypass all gates.
 *
 * To graduate a feature from beta to stable:
 *   1. Move its key from BETA_FEATURES to the stable section above.
 *   2. Delete any existing flags for it in the Admin Feature Flags page.
 *      (no flag = stable feature = ON for everyone)
 */
export const BETA_FEATURES = new Set<string>([
  "template_studio",
  "video_timeline",
  "goal_tracker",
  "drop_campaign",
  "grow_hub",
  "caption_library",
  "ugc_lab",
  "brand_builder",
  "campaign_mode",
]);

/**
 * Returns a Set of feature keys that are DISABLED for the given user.
 *
 * Resolution order (highest priority first):
 *  1. Per-user flag exists → use its enabled value
 *  2. Global flag exists → use its enabled value
 *  3. No flag + feature is BETA → disabled (default OFF)
 *  4. No flag + feature is STABLE → enabled (default ON)
 */
export async function getDisabledFeatures(userId: string): Promise<Set<string>> {
  try {
    const flags = await db
      .select()
      .from(featureFlagsTable)
      .where(or(isNull(featureFlagsTable.userId), eq(featureFlagsTable.userId, userId)));

    // Group by key, per-user flag always wins over global
    const resolved = new Map<string, boolean>();
    for (const flag of flags) {
      if (flag.userId === userId) {
        // Per-user override — highest priority
        resolved.set(flag.key, flag.enabled);
      } else if (!resolved.has(flag.key)) {
        // Global flag — only set if no per-user flag already recorded
        resolved.set(flag.key, flag.enabled);
      }
    }

    const disabled = new Set<string>();

    // Features with an explicit flag: use the resolved value
    for (const [key, enabled] of Array.from(resolved)) {
      if (!enabled) disabled.add(key);
    }

    // Beta features with NO flag at all → treat as disabled by default
    for (const betaKey of Array.from(BETA_FEATURES)) {
      if (!resolved.has(betaKey)) {
        disabled.add(betaKey);
      }
    }

    return disabled;
  } catch (err) {
    // Log so DB errors are visible rather than silently showing all features.
    // Fail open (return empty disabled set) so the page still loads.
    console.error("[feature-flags] getDisabledFeatures failed:", err);
    return new Set();
  }
}
