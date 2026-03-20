import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getConnectedAccountsOAuthRedirectUri } from "@/lib/connected-accounts-oauth-origin";
import type { ConnectedPlatform } from "@/db/schema/connected-accounts-schema";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

const PLATFORMS: ConnectedPlatform[] = ["tiktok", "youtube", "instagram", "facebook"];

/** Facebook Login only — https://www.facebook.com/v21.0/dialog/oauth (never use for Instagram). */
const FACEBOOK_LOGIN_SCOPES = "pages_show_list,pages_read_engagement,public_profile";

/** Instagram Business Login only — https://www.instagram.com/oauth/authorize (never use FACEBOOK_APP_ID here). */
const INSTAGRAM_BUSINESS_SCOPES = "instagram_business_basic,instagram_business_content_publish";

const FACEBOOK_DIALOG_OAUTH = "https://www.facebook.com/v21.0/dialog/oauth";
const INSTAGRAM_OAUTH_AUTHORIZE = "https://www.instagram.com/oauth/authorize";

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
 * Instagram Business Login: Instagram authorize URL, Instagram App ID, IG business scopes only.
 */
function buildInstagramBusinessLoginAuthUrl(callbackUrl: string, state: string): string | null {
  const instagramAppId = process.env.INSTAGRAM_APP_ID?.trim() ?? "";
  if (!instagramAppId) return null;
  const params = new URLSearchParams({
    client_id: instagramAppId,
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: INSTAGRAM_BUSINESS_SCOPES,
    state,
    // Show Instagram professional login / account flow instead of skipping straight to re-consent when possible.
    // https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login
    force_reauth: "true",
    enable_fb_login: "false",
  });
  const authUrl = `${INSTAGRAM_OAUTH_AUTHORIZE}?${params.toString()}`;
  console.log("[Instagram OAuth redirect_uri] connect (authorize):", params.get("redirect_uri"));
  console.log("[connected-accounts/connect] Instagram Business Login:", {
    endpoint: INSTAGRAM_OAUTH_AUTHORIZE,
    client_id: instagramAppId,
    scope: INSTAGRAM_BUSINESS_SCOPES,
    redirect_uri: callbackUrl,
    fullAuthUrl: authUrl,
  });
  return authUrl;
}

function buildAuthUrl(platform: ConnectedPlatform, state: string, _request: NextRequest): string | null {
  const callbackUrl = getConnectedAccountsOAuthRedirectUri();

  switch (platform) {
    case "tiktok": {
      const clientKey = process.env.TIKTOK_CLIENT_KEY;
      if (!clientKey) return null;
      const scopes = "user.info.basic,video.list,video.upload";
      const params = new URLSearchParams({
        client_key: clientKey,
        scope: scopes,
        response_type: "code",
        redirect_uri: callbackUrl,
        state,
      });
      return `https://www.tiktok.com/auth/authorize/?${params.toString()}`;
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
        prompt: "consent",
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
      return buildInstagramBusinessLoginAuthUrl(callbackUrl, state);
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

    const state = `${platform}:${randomBytes(16).toString("hex")}`;
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
