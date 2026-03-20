import type { NextRequest } from "next/server";

const PRODUCTION_ORIGIN = "https://contentflywheel.co.uk";
const LOCAL_ORIGIN = "http://localhost:3000";

/**
 * Infer public origin for OAuth redirect_uri and post-auth redirects.
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

export function getOAuthCallbackUrl(request: NextRequest): string {
  return `${getConnectedAccountsOAuthOrigin(request).replace(/\/$/, "")}/api/connected-accounts/callback`;
}

export function getConnectedAccountsSettingsUrl(request: NextRequest): string {
  return `${getConnectedAccountsOAuthOrigin(request).replace(/\/$/, "")}/dashboard/settings/connected-accounts`;
}
