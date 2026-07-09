/**
 * Platform analytics dispatcher
 * ──────────────────────────────────────────────────────────────────────────────
 * Central entry point. Given a published item + userId:
 *  1. Looks up OAuth token from connectedAccountsTable
 *  2. Calls the platform-specific fetcher
 *  3. Returns RealMetrics | null (null = not connected or fetch failed)
 *
 * The caller (post-publish-pipeline.ts) falls back to simulateMetrics() on null.
 */

import { db } from "@/db";
import { connectedAccountsTable } from "@/db/schema/connected-accounts-schema";
import { eq, and } from "drizzle-orm";
import type { MarketingManagerId, PublishedItem } from "@/db/schema/launch-schema";
import type { RealMetrics, ConnectedToken } from "./types";
import { fetchYouTubeMetrics }   from "./youtube";
import { fetchTikTokMetrics }    from "./tiktok";
import { fetchLinkedInMetrics }  from "./linkedin";
import { fetchXMetrics }         from "./x";
import { fetchInstagramMetrics } from "./instagram";

export type { RealMetrics } from "./types";

/* ─── Platform → connectedAccountsTable platform value map ──────────────────── */

const PLATFORM_MAP: Partial<Record<MarketingManagerId, string>> = {
  youtube:   "youtube",
  tiktok:    "tiktok",
  linkedin:  "linkedin",
  x:         "x",
  instagram: "instagram",
  // email and seo don't have OAuth-based analytics
};

/* ─── Token loader ───────────────────────────────────────────────────────────── */

async function loadToken(userId: string, platformKey: string): Promise<ConnectedToken | null> {
  try {
    const [row] = await db
      .select()
      .from(connectedAccountsTable)
      .where(and(
        eq(connectedAccountsTable.userId, userId),
        eq(connectedAccountsTable.platform, platformKey as "tiktok"),
      ));
    if (!row) return null;
    return {
      accessToken:       row.accessToken,
      refreshToken:      row.refreshToken,
      expiresAt:         row.expiresAt,
      platformUserId:    row.platformUserId,
      platformUsername:  row.platformUsername,
    };
  } catch {
    return null;
  }
}

/* ─── Main export ────────────────────────────────────────────────────────────── */

/**
 * Fetch real metrics for a published item.
 * Returns null if the platform is not connected or the API call fails.
 * The caller should fall back to simulateMetrics() on null.
 */
export async function fetchRealMetrics(
  userId:        string,
  publishedItem: PublishedItem,
): Promise<RealMetrics | null> {
  const { managerId, platformPostId } = publishedItem;
  if (!platformPostId) return null;

  const platformKey = PLATFORM_MAP[managerId];
  if (!platformKey) return null;

  const token = await loadToken(userId, platformKey);
  if (!token) return null;

  try {
    switch (managerId) {
      case "youtube":
        return await fetchYouTubeMetrics(token, platformPostId);
      case "tiktok":
        return await fetchTikTokMetrics(token, platformPostId);
      case "linkedin":
        return await fetchLinkedInMetrics(token, platformPostId);
      case "x":
        return await fetchXMetrics(token, platformPostId);
      case "instagram":
        return await fetchInstagramMetrics(token, platformPostId);
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * Convenience: check if a platform is connected for a user.
 */
export async function isPlatformConnected(
  userId:    string,
  managerId: MarketingManagerId,
): Promise<boolean> {
  const platformKey = PLATFORM_MAP[managerId];
  if (!platformKey) return false;
  const token = await loadToken(userId, platformKey);
  return token !== null;
}
