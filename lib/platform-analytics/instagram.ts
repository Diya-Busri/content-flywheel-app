/**
 * Instagram (Meta Graph API) analytics fetcher
 * ──────────────────────────────────────────────────────────────────────────────
 * Fetches media insights for published Instagram Business/Creator posts.
 * Requires token stored in connectedAccountsTable for platform="instagram".
 *
 * Scopes needed: instagram_basic, instagram_manage_insights, pages_show_list
 * Token type: Facebook User Access Token (long-lived, 60 days)
 *
 * Note: Requires Instagram Business or Creator account linked to a Facebook Page.
 */

import type { RealMetrics, ConnectedToken } from "./types";

const META_GRAPH = "https://graph.facebook.com/v19.0";

export async function refreshMetaToken(token: string): Promise<string | null> {
  // Meta long-lived tokens can be refreshed by calling the extend endpoint
  try {
    const res  = await fetch(
      `${META_GRAPH}/oauth/access_token?grant_type=fb_exchange_token` +
      `&client_id=${process.env.META_APP_ID}` +
      `&client_secret=${process.env.META_APP_SECRET}` +
      `&fb_exchange_token=${token}`,
    );
    const json = await res.json() as { access_token?: string };
    return json.access_token ?? null;
  } catch {
    return null;
  }
}

export async function fetchInstagramMetrics(
  token: ConnectedToken,
  mediaId: string,
): Promise<RealMetrics | null> {
  let accessToken = token.accessToken;

  // Try to refresh if nearly expired
  if (token.expiresAt) {
    const daysLeft = (new Date(token.expiresAt).getTime() - Date.now()) / 86_400_000;
    if (daysLeft < 7 && token.refreshToken) {
      const fresh = await refreshMetaToken(accessToken);
      if (fresh) accessToken = fresh;
    }
  }

  try {
    // Fetch media insights
    const metricsToFetch = [
      "impressions", "reach", "likes", "comments", "shares", "saved",
      "video_views", "plays",
    ].join(",");

    const res  = await fetch(
      `${META_GRAPH}/${mediaId}/insights?metric=${metricsToFetch}&period=lifetime`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const json = await res.json() as {
      data?: Array<{ name: string; values?: Array<{ value: number }> }>;
    };

    if (!json.data) return null;

    const getValue = (name: string) =>
      json.data!.find(d => d.name === name)?.values?.[0]?.value ?? 0;

    return {
      views:       getValue("impressions"),
      reach:       getValue("reach"),
      impressions: getValue("impressions"),
      likes:       getValue("likes"),
      comments:    getValue("comments"),
      shares:      getValue("shares"),
      saves:       getValue("saved"),
      watchTime:   0, // not available in basic insights
      lastFetched: new Date().toISOString(),
      isReal:      true,
    };
  } catch {
    return null;
  }
}
