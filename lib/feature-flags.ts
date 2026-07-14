import { db } from "@/db/db";
import { featureFlagsTable } from "@/db/schema/feature-flags-schema";
import { eq, or, isNull } from "drizzle-orm";
import { isAdmin } from "@/lib/is-admin";

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
  MARKETPLACE: "marketplace",

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
  /** Academy end-of-lesson "Understanding Check" AI checkpoint. Admins always bypass (see isAdmin() in dashboard/layout.tsx). */
  ACADEMY_UNDERSTANDING_CHECK: "academy_understanding_check",
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

/**
 * Deterministic 32-bit string hash (FNV-1a-style) — pure, no crypto needed.
 * Same input always produces the same output, which is exactly what a stable
 * rollout needs: a user should never flip in and out of a rollout bucket
 * between requests just because of a different random draw.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0; // |0 keeps it a 32-bit int
  }
  return Math.abs(hash);
}

/**
 * Deterministic percentage rollout: the same (userId, key) pair always
 * resolves to the same in/out result for a given percentage, with no
 * per-user storage needed. Different flags roll out independent subsets of
 * users since the key is part of the hash input.
 */
export function isInRollout(userId: string, key: string, percentage: number): boolean {
  if (percentage >= 100) return true;
  if (percentage <= 0) return false;
  return hashString(`${key}:${userId}`) % 100 < percentage;
}

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
  "academy_understanding_check",
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

    // Group by key, per-user flag always wins over global.
    // Normalize keys so "video-timeline" and "video_timeline" are treated identically.
    // Rollout percentage only ever applies to the GLOBAL row for a key — a
    // per-user override always wins outright, regardless of rollout.
    const resolved = new Map<string, { enabled: boolean; isPerUser: boolean; rolloutPercentage: number | null }>();
    for (const flag of flags) {
      const key = flag.key.replace(/-/g, "_");
      if (flag.userId === userId) {
        // Per-user override — highest priority
        resolved.set(key, { enabled: flag.enabled, isPerUser: true, rolloutPercentage: null });
      } else if (!resolved.has(key)) {
        // Global flag — only set if no per-user flag already recorded
        resolved.set(key, { enabled: flag.enabled, isPerUser: false, rolloutPercentage: flag.rolloutPercentage });
      }
    }

    const disabled = new Set<string>();

    // Features with an explicit flag: use the resolved value
    for (const [key, info] of Array.from(resolved)) {
      const finalEnabled =
        !info.isPerUser && info.enabled && info.rolloutPercentage != null
          ? isInRollout(userId, key, info.rolloutPercentage)
          : info.enabled;
      if (!finalEnabled) disabled.add(key);
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

/**
 * Returns a Set of feature keys that have been EXPLICITLY enabled via a flag
 * (global or per-user). This is used to let admin-enabled flags override
 * use-case-based hiding in the dashboard layout.
 */
export async function getExplicitlyEnabledFeatures(userId: string): Promise<Set<string>> {
  try {
    const flags = await db
      .select()
      .from(featureFlagsTable)
      .where(or(isNull(featureFlagsTable.userId), eq(featureFlagsTable.userId, userId)));

    const resolved = new Map<string, { enabled: boolean; isPerUser: boolean; rolloutPercentage: number | null }>();
    for (const flag of flags) {
      const key = flag.key.replace(/-/g, "_");
      if (flag.userId === userId) {
        resolved.set(key, { enabled: flag.enabled, isPerUser: true, rolloutPercentage: null });
      } else if (!resolved.has(key)) {
        resolved.set(key, { enabled: flag.enabled, isPerUser: false, rolloutPercentage: flag.rolloutPercentage });
      }
    }

    const explicitlyEnabled = new Set<string>();
    for (const [key, info] of Array.from(resolved)) {
      const finalEnabled =
        !info.isPerUser && info.enabled && info.rolloutPercentage != null
          ? isInRollout(userId, key, info.rolloutPercentage)
          : info.enabled;
      if (finalEnabled) explicitlyEnabled.add(key);
    }
    return explicitlyEnabled;
  } catch {
    return new Set();
  }
}

/**
 * For PUBLIC / unauthenticated pages (no logged-in visitor to resolve
 * per-user overrides or rollout percentages against — e.g. the public
 * marketplace page or a creator's public storefront). Only the GLOBAL flag
 * row for a key can hide a feature from anonymous visitors.
 *
 * Admins bypass this, same as FeatureGate, so they can preview a disabled
 * public page/link without logging out.
 */
export async function isFeatureEnabledForVisitors(featureKey: string): Promise<boolean> {
  const normalizedTarget = featureKey.replace(/-/g, "_");
  try {
    const adminUser = await isAdmin();
    if (adminUser) return true;

    const flags = await db
      .select()
      .from(featureFlagsTable)
      .where(isNull(featureFlagsTable.userId));

    const flag = flags.find((f) => f.key.replace(/-/g, "_") === normalizedTarget);

    // No global flag: stable features default ON, beta features default OFF.
    if (!flag) return !BETA_FEATURES.has(normalizedTarget);
    return flag.enabled;
  } catch (err) {
    console.error("[feature-flags] isFeatureEnabledForVisitors failed:", err);
    return true; // fail open, same as getDisabledFeatures
  }
}
