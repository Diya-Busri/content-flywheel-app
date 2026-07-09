/**
 * Platform analytics — shared types
 * ──────────────────────────────────────────────────────────────────────────────
 * Standardised metrics shape returned by every platform fetcher.
 * Maps directly to AnalyticsMetrics in launch-schema.ts.
 */

export type RealMetrics = {
  views?:          number;
  reach?:          number;
  impressions?:    number;
  likes?:          number;
  comments?:       number;
  shares?:         number;
  saves?:          number;
  watchTime?:      number;  // seconds
  retention?:      number;  // 0-100 (%)
  ctr?:            number;  // 0-100 (%)
  followersGained?: number;
  profileVisits?:  number;
  linkClicks?:     number;
  /** ISO timestamp — when these metrics were last fetched from the platform */
  lastFetched:     string;
  /** True = live platform data; false = simulated */
  isReal:          boolean;
};

/** Stored token row from connectedAccountsTable */
export type ConnectedToken = {
  accessToken:       string;
  refreshToken?:     string | null;
  expiresAt?:        Date | null;
  platformUserId?:   string | null;
  platformUsername?: string | null;
};
