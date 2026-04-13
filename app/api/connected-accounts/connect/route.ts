import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getConnectedAccountsOAuthRedirectUri } from "@/lib/connected-accounts-oauth-origin";
import type { ConnectedPlatform } from "@/db/schema/connected-accounts-schema";
import { randomBytes } from "crypto";
import { INSTAGRAM_FACEBOOK_CONNECT_SCOPES } from "@/lib/instagram-facebook-connect-scopes";

export const dynamic = "force-dynamic";

const PLATFORMS: ConnectedPlatform[] = ["tiktok", "youtube", "instagram", "facebook"];

/** Facebook Login — basic page / profile (no Instagram publishing). */
const FACEBOOK_LOGIN_SCOPES = "pages_show_list,pages_read_engagement,public_profile";

const FACEBOOK_DIALOG_OAUTH = "https://www.facebook.com/v21.0/dialog/oauth";

/**
 * Facebook Login: Meta dialog OAuth, Facebook App ID, page/user scopes only.
 */
function buildFacebookLoginAuthUrl(callbackUrl: string, state: string): string | null {
  const facebookAppId = process.env.FACEBOOK_APP_ID?.trim() ?? "";
  if (!facebookAppId) return null;
  const params = new URLSearchParams({
    client_id: facebookAppId,
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: FACEBOOK_LOGIN_SCOPES,
    state,
  });
  const authUrl = `${FACEBOOK_DIALOG_OAUTH}?${params.toString()}`;
  console.log("[connected-accounts/connect] Facebook Login:", {
    endpoint: FACEBOOK_DIALOG_OAUTH,
    client_id: facebookAppId,
    scope: FACEBOOK_LOGIN_SCOPES,
    redirect_uri: callbackUrl,
    fullAuthUrl: authUrl,
  });
  return authUrl;
}

/**
 * Instagram: Facebook Login dialog only (never instagram.com/oauth).
 * client_id = FACEBOOK_APP_ID; redirect_uri = app callback; scopes for Page + Instagram Graph.
 */
const FACEBOOK_OAUTH_DIALOG_INSTAGRAM = "https://www.facebook.com/v21.0/dialog/oauth";

function buildInstagramViaFacebookAuthUrl(callbackUrl: string, state: string): string | null {
  const facebookAppId = process.env.FACEBOOK_APP_ID?.trim() ?? "";
  if (!facebookAppId) return null;
  const params = new URLSearchParams({
    client_id: facebookAppId,
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: INSTAGRAM_FACEBOOK_CONNECT_SCOPES,
    state,
  });
  const authUrl = `${FACEBOOK_OAUTH_DIALOG_INSTAGRAM}?${params.toString()}`;
  console.log("[connected-accounts/connect] Instagram → Facebook dialog/oauth (v19):", {
    endpoint: FACEBOOK_OAUTH_DIALOG_INSTAGRAM,
    client_id: facebookAppId,
    scope: INSTAGRAM_FACEBOOK_CONNECT_SCOPES,
    redirect_uri: callbackUrl,
  });
  return authUrl;
}

function buildAuthUrl(platform: ConnectedPlatform, state: string, _request: NextRequest): string | null {
  const callbackUrl = getConnectedAccountsOAuthRedirectUri();

  switch (platform) {
    case "tiktok": {
      const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim() ?? "";
      if (!clientKey) return null;
      const scopes = "user.info.basic,user.info.profile,user.info.stats,video.list,video.publish";
      const params = new URLSearchParams({
        client_key: clientKey,
        scope: scopes,
        response_type: "code",
        redirect_uri: callbackUrl,
        state,
      });
      const authUrl = `https://www.tiktok.com/v2/auth/authorize?${params.toString()}`;
      console.log("[connected-accounts/connect] TikTok OAuth:", {
        endpoint: "https://www.tiktok.com/v2/auth/authorize",
        client_key: clientKey,
        scope: scopes,
        redirect_uri: callbackUrl,
        fullAuthUrl: authUrl,
      });
      return authUrl;
    }
    case "youtube": {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId) return null;
      const xfHost = _request.headers.get("x-forwarded-host");
      const hostHeader = _request.headers.get("host");
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: callbackUrl,
        response_type: "code",
        scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
        access_type: "offline",
        prompt: "select_account consent",
        max_age: "0",
        state,
      });
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      console.log("[connected-accounts/connect] YouTube OAuth diagnostics:", {
        callbackUrl,
        redirect_uri_in_params: params.get("redirect_uri"),
        x_forwarded_host: xfHost,
        host: hostHeader,
        note: "callbackUrl is getConnectedAccountsOAuthRedirectUri() — NEXT_PUBLIC_APP_URL or production origin",
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "(unset)",
      });
      console.log("[connected-accounts/connect] YouTube redirect_uri sent to Google:", callbackUrl);
      console.log("[connected-accounts/connect] YouTube full auth URL:", authUrl);
      return authUrl;
    }
    case "instagram": {
      return buildInstagramViaFacebookAuthUrl(callbackUrl, state);
    }
    case "facebook": {
      return buildFacebookLoginAuthUrl(callbackUrl, state);
    }
    default:
      return null;
  }
}

/** POST: Get OAuth URL for a platform. Body: { platform: "tiktok" | "youtube" | "instagram" | "facebook" }. */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const platform = body?.platform as ConnectedPlatform | undefined;
    if (!platform || !PLATFORMS.includes(platform)) {
      return NextResponse.json(
        { error: "Invalid platform. Use: tiktok, youtube, instagram, facebook" },
        { status: 400 }
      );
    }

    const addAnother = body?.addAnother === true;
    // "platform:new:random" signals the callback to always INSERT (never update existing row)
    const state = addAnother
      ? `${platform}:new:${randomBytes(16).toString("hex")}`
      : `${platform}:${randomBytes(16).toString("hex")}`;
    console.log("[connected-accounts/connect] Starting OAuth for platform:", platform);
    const authUrl = buildAuthUrl(platform, state, request);
    if (!authUrl) {
      return NextResponse.json(
        {
          error: `OAuth not configured for ${platform}. Add the required env vars (see Settings → Connected Accounts).`,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ authUrl, state });
  } catch (err) {
    console.error("[connected-accounts/connect]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
