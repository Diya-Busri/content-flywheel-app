import type { NextRequest } from "next/server";

const PRODUCTION_ORIGIN = "https://contentflywheel.co.uk";
const LOCAL_ORIGIN = "http://localhost:3000";

/** Path segment only; full redirect URI is built via getConnectedAccountsOAuthRedirectUri(). */
export const CONNECTED_ACCOUNTS_OAUTH_CALLBACK_PATH = "/api/connected-accounts/callback";

/**
 * Canonical site origin for OAuth `redirect_uri` (Meta/Google/TikTok must match authorize + token exchange exactly).
 * Uses NEXT_PUBLIC_APP_URL when set; otherwise production. Not derived from request Host headers.
 */
export function getConnectedAccountsPublicOriginForOAuth(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return PRODUCTION_ORIGIN;
}

/**
 * Exact `redirect_uri` string for all connected-accounts OAuth providers (authorize URL + token POST).
 * Must match an allowlisted URI in each provider dashboard (e.g. https://contentflywheel.co.uk/api/connected-accounts/callback).
 */
export function getConnectedAccountsOAuthRedirectUri(): string {
  return `${getConnectedAccountsPublicOriginForOAuth()}${CONNECTED_ACCOUNTS_OAUTH_CALLBACK_PATH}`;
}

/**
 * Infer public origin for post-auth browser redirects (settings page).
 * Local dev (Host / X-Forwarded-Host) → http://localhost:3000; otherwise production.
 */
export function getConnectedAccountsOAuthOrigin(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-host");
  const rawHost = (forwarded?.split(",")[0]?.trim() || request.headers.get("host") || "").trim();
  if (!rawHost) return PRODUCTION_ORIGIN;
  const hostname = rawHost.split(":")[0]?.toLowerCase() ?? "";
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return LOCAL_ORIGIN;
  }
  return PRODUCTION_ORIGIN;
}

/** OAuth callback URL (same string on connect + token exchange). `request` is ignored; kept for call-site compatibility. */
export function getOAuthCallbackUrl(_request?: NextRequest): string {
  return getConnectedAccountsOAuthRedirectUri();
}

export function getConnectedAccountsSettingsUrl(request: NextRequest): string {
  return `${getConnectedAccountsOAuthOrigin(request).replace(/\/$/, "")}/dashboard/settings/connected-accounts`;
}
