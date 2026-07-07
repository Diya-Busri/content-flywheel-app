/**
 * LinkedIn analytics fetcher
 * ──────────────────────────────────────────────────────────────────────────────
 * Uses the LinkedIn Marketing API v2 to fetch post/share statistics.
 * Requires token stored in connectedAccountsTable for platform="linkedin".
 *
 * Scopes needed: r_liteprofile, w_member_social, r_emailaddress
 * For org analytics: r_organization_social, rw_organization_admin
 *
 * LinkedIn refresh tokens: valid for 60 days. Need proactive refresh.
 */

import type { RealMetrics, ConnectedToken } from "./types";

const LI_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const LI_SHARE_URL = "https://api.linkedin.com/v2/socialActions";
const LI_STATS_URL = "https://api.linkedin.com/v2/organizationalEntityShareStatistics";

export async function refreshLinkedInToken(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch(LI_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id:     process.env.LINKEDIN_CLIENT_ID     ?? "",
        client_secret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
        refresh_token: refreshToken,
        grant_type:    "refresh_token",
      }),
    });
    const json = await res.json() as { access_token?: string };
    return json.access_token ?? null;
  } catch {
    return null;
  }
}

export async function fetchLinkedInMetrics(
  token: ConnectedToken,
  shareId: string,
): Promise<RealMetrics | null> {
  let accessToken = token.accessToken;

  if (token.expiresAt && new Date(token.expiresAt) < new Date() && token.refreshToken) {
    const fresh = await refreshLinkedInToken(token.refreshToken);
    if (!fresh) return null;
    accessToken = fresh;
  }

  try {
    // Fetch social actions (likes, comments)
    const actionRes  = await fetch(
      `${LI_SHARE_URL}/${encodeURIComponent(shareId)}`,
      { headers: { Authorization: `Bearer ${accessToken}`, "X-Restli-Protocol-Version": "2.0.0" } },
    );
    const actionJson = await actionRes.json() as {
      likesSummary?:   { totalLikes?: number };
      commentsSummary?: { totalFirstLevelComments?: number };
    };

    const likes    = actionJson.likesSummary?.totalLikes ?? 0;
    const comments = actionJson.commentsSummary?.totalFirstLevelComments ?? 0;

    // Fetch share statistics (impressions, clicks)
    // This requires organizationalEntity access — try, don't fail if not available
    let impressions = 0;
    let clicks = 0;
    try {
      const statsRes  = await fetch(
        `${LI_STATS_URL}?q=organizationalEntity&organizationalEntity=${encodeURIComponent(token.platformUserId ?? "")}&shares[0]=${encodeURIComponent(shareId)}&shareStatisticsType=INDIVIDUAL_SHARE`,
        { headers: { Authorization: `Bearer ${accessToken}`, "X-Restli-Protocol-Version": "2.0.0" } },
      );
      const statsJson = await statsRes.json() as {
        elements?: Array<{
          totalShareStatistics?: {
            impressionCount?: number;
            clickCount?: number;
            shareCount?: number;
          };
        }>;
      };
      const el = statsJson.elements?.[0]?.totalShareStatistics;
      impressions = el?.impressionCount ?? 0;
      clicks      = el?.clickCount      ?? 0;
    } catch { /* no org access — that's fine */ }

    return {
      views:       impressions,
      impressions,
      likes,
      comments,
      linkClicks:  clicks,
      lastFetched: new Date().toISOString(),
      isReal:      true,
    };
  } catch {
    return null;
  }
}
