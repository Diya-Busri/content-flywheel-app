/**
 * X (Twitter) analytics fetcher
 * ──────────────────────────────────────────────────────────────────────────────
 * Uses X API v2 to fetch tweet public metrics.
 * Requires token stored in connectedAccountsTable for platform="x".
 *
 * Scopes needed: tweet.read, users.read, offline.access
 * Impression metrics require "Elevated" access (apply at developer.twitter.com).
 * Basic public metrics (likes, retweets, replies) available on free tier.
 */

import type { RealMetrics, ConnectedToken } from "./types";

const X_TOKEN_URL = "https://api.twitter.com/2/oauth2/token";
const X_TWEET_URL = "https://api.twitter.com/2/tweets";

export async function refreshXToken(refreshToken: string): Promise<string | null> {
  try {
    const credentials = Buffer.from(
      `${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`
    ).toString("base64");

    const res = await fetch(X_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization:  `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        grant_type:    "refresh_token",
        client_id:     process.env.X_CLIENT_ID ?? "",
      }),
    });
    const json = await res.json() as { access_token?: string };
    return json.access_token ?? null;
  } catch {
    return null;
  }
}

export async function fetchXMetrics(
  token: ConnectedToken,
  tweetId: string,
): Promise<RealMetrics | null> {
  let accessToken = token.accessToken;

  if (token.expiresAt && new Date(token.expiresAt) < new Date() && token.refreshToken) {
    const fresh = await refreshXToken(token.refreshToken);
    if (!fresh) return null;
    accessToken = fresh;
  }

  try {
    const res  = await fetch(
      `${X_TWEET_URL}/${tweetId}?tweet.fields=public_metrics,non_public_metrics,organic_metrics`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const json = await res.json() as {
      data?: {
        public_metrics?: {
          retweet_count?: number;
          reply_count?:   number;
          like_count?:    number;
          quote_count?:   number;
          impression_count?: number;
          bookmark_count?:   number;
        };
        organic_metrics?: {
          impression_count?: number;
          url_link_clicks?:  number;
          user_profile_clicks?: number;
        };
      };
    };

    const pub = json.data?.public_metrics;
    const org = json.data?.organic_metrics;
    if (!pub) return null;

    const impressions = org?.impression_count ?? pub.impression_count ?? 0;

    return {
      views:        impressions,
      impressions,
      likes:        pub.like_count    ?? 0,
      shares:       pub.retweet_count ?? 0,
      comments:     pub.reply_count   ?? 0,
      linkClicks:   org?.url_link_clicks ?? 0,
      profileVisits: org?.user_profile_clicks ?? 0,
      lastFetched:  new Date().toISOString(),
      isReal:       true,
    };
  } catch {
    return null;
  }
}
