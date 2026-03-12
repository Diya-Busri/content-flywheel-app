import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { connectedAccountsTable } from "@/db/schema/connected-accounts-schema";
import { eq, and } from "drizzle-orm";
import type { ConnectedPlatform } from "@/db/schema/connected-accounts-schema";

export const dynamic = "force-dynamic";

const PLATFORMS: ConnectedPlatform[] = ["tiktok", "youtube", "instagram", "facebook"];

function getRedirectUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/dashboard/settings/connected-accounts`;
}

/**
 * GET: OAuth callback. Query: platform, code, state.
 * Exchanges code for tokens and stores in DB, then redirects to connected-accounts page.
 */
export async function GET(request: NextRequest) {
  const redirectUrl = getRedirectUrl();
  const errorRedirect = (msg: string) =>
    NextResponse.redirect(`${redirectUrl}?error=${encodeURIComponent(msg)}`);
  const successRedirect = () =>
    NextResponse.redirect(`${redirectUrl}?connected=1`);

  try {
    const { userId } = await auth();
    if (!userId) return errorRedirect("Please sign in first.");

    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform") as ConnectedPlatform | null;
    const code = searchParams.get("code");
    const errorParam = searchParams.get("error");

    if (errorParam) {
      return errorRedirect(errorParam === "access_denied" ? "Access denied." : errorParam);
    }
    if (!platform || !PLATFORMS.includes(platform)) {
      return errorRedirect("Invalid platform.");
    }
    if (!code) return errorRedirect("Missing authorization code.");

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      "http://localhost:3000";
    const callbackUrl = `${baseUrl.replace(/\/$/, "")}/api/connected-accounts/callback?platform=${platform}`;

    let accessToken: string;
    let refreshToken: string | null = null;
    let expiresAt: Date | null = null;
    let platformUserId: string | null = null;
    let platformUsername: string | null = null;

    switch (platform) {
      case "tiktok": {
        const clientKey = process.env.TIKTOK_CLIENT_KEY;
        const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
        if (!clientKey || !clientSecret) {
          return errorRedirect("TikTok OAuth not configured.");
        }
        const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_key: clientKey,
            client_secret: clientSecret,
            code,
            grant_type: "authorization_code",
            redirect_uri: callbackUrl,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.access_token) {
          return errorRedirect(data.error?.description || "TikTok token exchange failed.");
        }
        accessToken = data.access_token;
        refreshToken = data.refresh_token || null;
        if (data.expires_in) {
          const d = new Date();
          d.setSeconds(d.getSeconds() + data.expires_in);
          expiresAt = d;
        }
        break;
      }
      case "youtube": {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
          return errorRedirect("YouTube OAuth not configured.");
        }
        const res = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            grant_type: "authorization_code",
            redirect_uri: callbackUrl,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.access_token) {
          return errorRedirect(data.error_description || "YouTube token exchange failed.");
        }
        accessToken = data.access_token;
        refreshToken = data.refresh_token || null;
        if (data.expires_in) {
          const d = new Date();
          d.setSeconds(d.getSeconds() + data.expires_in);
          expiresAt = d;
        }
        break;
      }
      case "instagram": {
        const instagramClientId = process.env.INSTAGRAM_BASIC_APP_ID;
        const instagramClientSecret = process.env.INSTAGRAM_BASIC_APP_SECRET;
        if (!instagramClientId || !instagramClientSecret) {
          return errorRedirect("Instagram OAuth not configured.");
        }
        const res = await fetch("https://api.instagram.com/oauth/access_token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: instagramClientId,
            client_secret: instagramClientSecret,
            grant_type: "authorization_code",
            redirect_uri: callbackUrl,
            code,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.access_token) {
          return errorRedirect(data.error_message || "Instagram token exchange failed.");
        }
        accessToken = data.access_token;
        platformUserId = data.user_id != null ? String(data.user_id) : null;
        if (data.expires_in) {
          const d = new Date();
          d.setSeconds(d.getSeconds() + data.expires_in);
          expiresAt = d;
        }
        break;
      }
      case "facebook": {
        const facebookAppId = process.env.FACEBOOK_APP_ID;
        const facebookAppSecret = process.env.FACEBOOK_APP_SECRET;
        if (!facebookAppId || !facebookAppSecret) {
          return errorRedirect("Facebook OAuth not configured.");
        }
        const res = await fetch(
          `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${facebookAppId}&client_secret=${facebookAppSecret}&redirect_uri=${encodeURIComponent(callbackUrl)}&code=${encodeURIComponent(code)}`
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.access_token) {
          return errorRedirect(data.error?.message || "Facebook token exchange failed.");
        }
        accessToken = data.access_token;
        if (data.expires_in) {
          const d = new Date();
          d.setSeconds(d.getSeconds() + data.expires_in);
          expiresAt = d;
        }
        break;
      }
      default:
        return errorRedirect("Unknown platform.");
    }

    const existing = await db
      .select()
      .from(connectedAccountsTable)
      .where(
        and(
          eq(connectedAccountsTable.userId, userId),
          eq(connectedAccountsTable.platform, platform)
        )
      )
      .limit(1);

    const row = {
      userId,
      platform,
      accessToken,
      refreshToken,
      expiresAt,
      platformUserId: platformUserId ?? undefined,
      platformUsername: platformUsername ?? undefined,
      updatedAt: new Date(),
    };

    if (existing.length > 0) {
      await db
        .update(connectedAccountsTable)
        .set({
          accessToken: row.accessToken,
          refreshToken: row.refreshToken ?? null,
          expiresAt: row.expiresAt,
          platformUserId: row.platformUserId ?? null,
          platformUsername: row.platformUsername ?? null,
          updatedAt: row.updatedAt,
        })
        .where(
          and(
            eq(connectedAccountsTable.userId, userId),
            eq(connectedAccountsTable.platform, platform)
          )
        );
    } else {
      await db.insert(connectedAccountsTable).values({
        userId: row.userId,
        platform: row.platform,
        accessToken: row.accessToken,
        refreshToken: row.refreshToken ?? null,
        expiresAt: row.expiresAt,
        platformUserId: row.platformUserId ?? null,
        platformUsername: row.platformUsername ?? null,
      });
    }

    return successRedirect();
  } catch (err) {
    console.error("[connected-accounts/callback]", err);
    return errorRedirect(
      err instanceof Error ? err.message : "Connection failed."
    );
  }
}
