/**
 * TikTok analytics fetcher
 * ──────────────────────────────────────────────────────────────────────────────
 * Uses the TikTok for Developers v2 API to fetch video metrics.
 * Requires token stored in connectedAccountsTable for platform="tiktok".
 *
 * Scopes needed: video.list, video.publish
 * Refresh: TikTok uses standard OAuth 2.0 refresh_token grant.
 *
 * Note: TikTok's Research API requires separate approval.
 * This implementation uses the standard creator API which is available by default.
 */

import type { RealMetrics, ConnectedToken } from "./types";

const TIKTOK_REFRESH_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const TIKTOK_VIDEO_URL   = "https://open.tiktokapis.com/v2/video/query/";

export async function refreshTikTokToken(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch(TIKTOK_REFRESH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key:    process.env.TIKTOK_CLIENT_KEY    ?? "",
        client_secret: process.env.TIKTOK_CLIENT_SECRET ?? "",
        refresh_token: refreshToken,
        grant_type:    "refresh_token",
      }),
    });
    const json = await res.json() as { data?: { access_token?: string } };
    return json.data?.access_token ?? null;
  } catch {
    return null;
  }
}

export async function fetchTikTokMetrics(
  token: ConnectedToken,
  videoId: string,
): Promise<RealMetrics | null> {
  let accessToken = token.accessToken;

  if (token.expiresAt && new Date(token.expiresAt) < new Date() && token.refreshToken) {
    const fresh = await refreshTikTokToken(token.refreshToken);
    if (!fresh) return null;
    accessToken = fresh;
  }

  try {
    const res  = await fetch(
      `${TIKTOK_VIDEO_URL}?fields=id,title,video_description,duration,cover_image_url,share_url,play_count,digg_count,comment_count,share_count`,
      {
        method: "POST",
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filters: { video_ids: [videoId] },
        }),
      },
    );
    const json = await res.json() as {
      data?: {
        videos?: Array<{
          play_count?:    number;
          digg_count?:    number;
          comment_count?: number;
          share_count?:   number;
        }>;
      };
    };

    const video = json.data?.videos?.[0];
    if (!video) return null;

    return {
      views:       video.play_count    ?? 0,
      likes:       video.digg_count    ?? 0,
      comments:    video.comment_count ?? 0,
      shares:      video.share_count   ?? 0,
      lastFetched: new Date().toISOString(),
      isReal:      true,
    };
  } catch {
    return null;
  }
}
