import { db } from "@/db/db";
import { featureFlagsTable } from "@/db/schema/feature-flags-schema";
import { eq, or, isNull } from "drizzle-orm";

/**
 * Feature flag keys — must match what you create in the Admin Feature Flags page.
 * If NO flag exists for a key, the feature is ON by default.
 * Create a flag with enabled=false to disable it.
 */
export const FEATURE_KEYS = {
  AI_COACH: "ai_coach",
  TEMPLATE_STUDIO: "template_studio",
  VIDEO_TIMELINE: "video_timeline",
  VIDEO_CREDITS: "video_credits",
  MY_LIBRARY: "my_library",
  CONTENT_CALENDAR: "content_calendar",
  SCRIPT_CHECKER: "script_checker",
  DIGITAL_PRODUCTS: "digital_products",
  TIKTOK_SHOP: "tiktok_shop",
  PRINT_ON_DEMAND: "print_on_demand",
  EMAIL_MARKETING: "email_marketing",
  GOAL_TRACKER: "goal_tracker",
  DROP_CAMPAIGN: "drop_campaign",
  GROW_HUB: "grow_hub",
  CAPTION_LIBRARY: "caption_library",
  YOUTUBE_UPLOAD: "youtube_upload",
  INVITE_CREATORS: "invite_creators",
  // Beta / internal tools
  UGC_LAB: "ugc_lab",
  BRAND_BUILDER: "brand_builder",
  CAMPAIGN_MODE: "campaign_mode",
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

/**
 * Returns a Set of feature keys that are DISABLED for the given user.
 * Logic (per-user overrides global):
 *  1. If a per-user flag exists → use that enabled value
 *  2. Else if a global flag exists → use that enabled value
 *  3. If no flag → feature is ON
 */
export async function getDisabledFeatures(userId: string): Promise<Set<string>> {
  try {
    const flags = await db
      .select()
      .from(featureFlagsTable)
      .where(or(isNull(featureFlagsTable.userId), eq(featureFlagsTable.userId, userId)));

    // Group by key, prefer per-user flag over global
    const resolved = new Map<string, boolean>();
    for (const flag of flags) {
      const existing = resolved.get(flag.key);
      // Per-user flag always wins
      if (flag.userId === userId) {
        resolved.set(flag.key, flag.enabled);
      } else if (existing === undefined) {
        // Global flag, only set if no per-user flag yet
        resolved.set(flag.key, flag.enabled);
      }
    }

    const disabled = new Set<string>();
    for (const [key, enabled] of Array.from(resolved)) {
      if (!enabled) disabled.add(key.replace(/-/g, "_"));
    }
    return disabled;
  } catch {
    // Never block the page if flag check fails
    return new Set();
  }
}
