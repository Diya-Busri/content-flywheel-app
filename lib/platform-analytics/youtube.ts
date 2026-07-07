/**
 * YouTube Analytics fetcher
 * ──────────────────────────────────────────────────────────────────────────────
 * Uses the YouTube Analytics API v2 to fetch real video metrics.
 * Requires OAuth token stored in connectedAccountsTable for platform="youtube".
 *
 * Scopes needed: https://www.googleapis.com/auth/youtube.readonly
 *                https://www.googleapis.com/auth/yt-analytics.readonly
 *
 * Token refresh: Google uses standard OAuth 2.0 refresh_token grant.
 */

import type { RealMetrics, ConnectedToken } from "./types";

const YT_TOKEN_URL   = "https://oauth2.googleapis.com/token";
const YT_VIDEOS_URL  = "https://www.googleapis.com/youtube/v3/videos";
const YTA_REPORT_URL = "https://youtubeanalytics.googleapis.com/v2/reports";

/* ─── Token refresh ──────────────────────────────────────────────────────────── */

export async function refreshYouTubeToken(refreshToken: string): Promise<string | null> {
  try {
    const res  = await fetch(YT_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id:     process.env.YOUTUBE_CLIENT_ID     ?? "",
        client_secret: process.env.YOUTUBE_CLIENT_SECRET ?? "",
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

/* ─── Main fetcher ───────────────────────────────────────────────────────────── */

export async function fetchYouTubeMetrics(
  token: ConnectedToken,
  videoId: string,
): Promise<RealMetrics | null> {
  let accessToken = token.accessToken;

  // Refresh if expired
  if (token.expiresAt && new Date(token.expiresAt) < new Date() && token.refreshToken) {
    const fresh = await refreshYouTubeToken(token.refreshToken);
    if (!fresh) return null;
    accessToken = fresh;
  }

  const now      = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const longAgo  = "2020-01-01";

  try {
    /* ── Video data (public stats) ── */
    const vidRes  = await fetch(
      `${YT_VIDEOS_URL}?part=statistics,contentDetails&id=${encodeURIComponent(videoId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const vidJson = await vidRes.json() as {
      items?: Array<{
        statistics: {
          viewCount?: string; likeCount?: string; commentCount?: string;
          favoriteCount?: string;
        };
        contentDetails?: { duration?: string };
      }>;
    };
    const item = vidJson.items?.[0];
    if (!item) return null;

    const views    = parseInt(item.statistics.viewCount    ?? "0", 10);
    const likes    = parseInt(item.statistics.likeCount    ?? "0", 10);
    const comments = parseInt(item.statistics.commentCount ?? "0", 10);

    /* ── Analytics API (requires yt-analytics scope) ── */
    const ytaRes  = await fetch(
      `${YTA_REPORT_URL}?ids=channel%3D%3DMINE` +
      `&startDate=${longAgo}&endDate=${todayStr}` +
      `&metrics=estimatedMinutesWatched,averageViewPercentage,subscribersGained,shares` +
      `&filters=video%3D%3D${encodeURIComponent(videoId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const ytaJson = await ytaRes.json() as {
      rows?: Array<Array<number>>;
      columnHeaders?: Array<{ name: string }>;
    };

    const row         = ytaJson.rows?.[0];
    const headers     = ytaJson.columnHeaders?.map(h => h.name) ?? [];
    const watchMins   = row ? row[headers.indexOf("estimatedMinutesWatched")] ?? 0 : 0;
    const retention   = row ? row[headers.indexOf("averageViewPercentage")] ?? 0 : 0;
    const subsGained  = row ? row[headers.indexOf("subscribersGained")] ?? 0 : 0;
    const sharesCount = row ? row[headers.indexOf("shares")] ?? 0 : 0;

    return {
      views,
      likes,
      comments,
      shares:          sharesCount,
      watchTime:       watchMins * 60,
      retention:       Math.round(retention),
      followersGained: subsGained,
      lastFetched:     now.toISOString(),
      isReal:          true,
    };
  } catch {
    return null;
  }
}
