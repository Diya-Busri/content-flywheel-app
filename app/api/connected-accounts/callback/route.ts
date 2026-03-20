import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getConnectedAccountsOAuthRedirectUri,
  getConnectedAccountsSettingsUrl,
} from "@/lib/connected-accounts-oauth-origin";
import { db } from "@/db/db";
import { connectedAccountsTable } from "@/db/schema/connected-accounts-schema";
import { eq, and } from "drizzle-orm";
import type { ConnectedPlatform, SelectConnectedAccount } from "@/db/schema/connected-accounts-schema";

export const dynamic = "force-dynamic";

const PLATFORMS: ConnectedPlatform[] = ["tiktok", "youtube", "instagram", "facebook"];

function getRedirectUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/dashboard/settings/connected-accounts`;
}

function getPlatformFromState(state: string | null): ConnectedPlatform | null {
  if (!state) return null;
  const raw = state.split(":")[0];
  return PLATFORMS.includes(raw as ConnectedPlatform) ? (raw as ConnectedPlatform) : null;
}

/** Log shape of Instagram token JSON without leaking access_token. */
function logInstagramTokenResponseBody(tokenJson: Record<string, unknown>, context: string): void {
  const data = tokenJson.data;
  const dataSummary =
    Array.isArray(data) ? { kind: "array", length: data.length } : data && typeof data === "object" ? { kind: "object" } : { kind: typeof data };
  console.log(`[connected-accounts/callback] Instagram token JSON (${context}):`, {
    keys: Object.keys(tokenJson),
    dataSummary,
    hasTopLevelAccessToken: typeof tokenJson.access_token === "string",
    hasErrorMessage: typeof tokenJson.error_message === "string",
    error_type: tokenJson.error_type,
  });
}

/**
 * GET: OAuth callback. Query: code, state.
 * Platform is resolved from state (not query params), then code is exchanged and stored.
 */
export async function GET(request: NextRequest) {
  const redirectUrl = getConnectedAccountsSettingsUrl(request);
  const errorRedirect = (msg: string) =>
    NextResponse.redirect(`${redirectUrl}?error=${encodeURIComponent(msg)}`);
  const successRedirect = () =>
    NextResponse.redirect(`${redirectUrl}?connected=1`);

  try {
    const { userId } = await auth();
    if (!userId) return errorRedirect("Please sign in first.");

    const { searchParams } = new URL(request.url);
    const state = searchParams.get("state");
    const platform = getPlatformFromState(state);
    const code = searchParams.get("code");
    const errorParam = searchParams.get("error");

    console.log("[connected-accounts/callback] Incoming OAuth callback:", {
      pathname: new URL(request.url).pathname,
      platformFromState: platform,
      statePrefix: state?.split(":")[0] ?? null,
      stateLength: state?.length ?? 0,
      hasCode: Boolean(code),
      errorParam,
    });

    if (errorParam) {
      return errorRedirect(errorParam === "access_denied" ? "Access denied." : errorParam);
    }
    if (!platform || !PLATFORMS.includes(platform)) {
      console.warn("[connected-accounts/callback] Invalid or missing platform in state:", {
        state: state ? `${state.slice(0, 24)}…` : null,
        resolved: platform,
      });
      return errorRedirect("Invalid platform.");
    }
    if (!code) return errorRedirect("Missing authorization code.");

    const callbackUrl = getConnectedAccountsOAuthRedirectUri();
    console.log("[connected-accounts/callback] OAuth redirect_uri for token exchange:", callbackUrl);

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
        console.log("[connected-accounts/callback] YouTube token exchange redirect_uri:", callbackUrl, {
          x_forwarded_host: request.headers.get("x-forwarded-host"),
          host: request.headers.get("host"),
        });
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
        try {
          const meRes = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const meData = (await meRes.json().catch(() => ({}))) as {
            items?: Array<{ id?: string; snippet?: { customUrl?: string; title?: string } }>;
          };
          const ch = meData.items?.[0];
          platformUserId = typeof ch?.id === "string" ? ch.id : null;
          platformUsername =
            typeof ch?.snippet?.customUrl === "string" && ch.snippet.customUrl.trim().length > 0
              ? ch.snippet.customUrl.trim()
              : typeof ch?.snippet?.title === "string"
                ? ch.snippet.title.trim()
                : null;
        } catch (e) {
          console.warn("[connected-accounts/callback] Could not fetch YouTube channel identity", e);
        }
        break;
      }
      case "instagram": {
        const instagramAppId = process.env.INSTAGRAM_APP_ID?.trim() ?? "";
        const instagramAppSecret =
          process.env.INSTAGRAM_APP_SECRET?.trim() || process.env.FACEBOOK_APP_SECRET?.trim();
        if (!instagramAppId || !instagramAppSecret) {
          console.error("[connected-accounts/callback] Instagram env missing:", {
            hasAppId: Boolean(instagramAppId),
            hasAppSecret: Boolean(instagramAppSecret),
          });
          return errorRedirect(
            "Instagram OAuth not configured. Set INSTAGRAM_APP_ID (Instagram App ID from Meta → Instagram → Business login) and INSTAGRAM_APP_SECRET or FACEBOOK_APP_SECRET for token exchange."
          );
        }
        console.log("[connected-accounts/callback] Instagram Business Login token exchange:", {
          endpoint: "https://api.instagram.com/oauth/access_token",
          client_id: instagramAppId,
          redirect_uri: callbackUrl,
          grant_type: "authorization_code",
        });
        let tokenRes: Response;
        try {
          tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: instagramAppId,
              client_secret: instagramAppSecret,
              grant_type: "authorization_code",
              redirect_uri: callbackUrl,
              code,
            }),
          });
        } catch (e) {
          console.error("[connected-accounts/callback] Instagram short-lived token fetch threw:", e);
          return errorRedirect("Instagram token exchange network error.");
        }
        const tokenJson = (await tokenRes.json().catch(() => ({}))) as {
          data?:
            | Array<{ access_token?: string; user_id?: string | number; permissions?: string }>
            | { access_token?: string; user_id?: string | number; permissions?: string };
          access_token?: string;
          user_id?: string | number;
          error_message?: string;
          error_type?: string;
        };
        logInstagramTokenResponseBody(tokenJson as Record<string, unknown>, `short-lived status=${tokenRes.status}`);
        console.log("[connected-accounts/callback] Instagram short-lived HTTP:", tokenRes.status, tokenRes.statusText);

        const dataBlock = tokenJson.data;
        const firstEntry =
          Array.isArray(dataBlock) && dataBlock.length > 0
            ? dataBlock[0]
            : dataBlock && typeof dataBlock === "object" && !Array.isArray(dataBlock)
              ? dataBlock
              : null;
        const shortLived =
          firstEntry?.access_token ??
          (typeof tokenJson.access_token === "string" ? tokenJson.access_token : undefined);
        const igUserIdRaw = firstEntry?.user_id ?? tokenJson.user_id;
        if (!tokenRes.ok || !shortLived) {
          const msg =
            tokenJson.error_message ||
            (tokenJson as { error?: { message?: string } }).error?.message ||
            "Instagram token exchange failed.";
          console.error("[connected-accounts/callback] Instagram short-lived token rejected:", {
            httpStatus: tokenRes.status,
            message: msg,
          });
          return errorRedirect(msg);
        }
        platformUserId = igUserIdRaw != null ? String(igUserIdRaw) : null;
        console.log("[connected-accounts/callback] Instagram short-lived OK:", {
          platformUserId,
          tokenLength: shortLived.length,
        });

        let longLivedToken = shortLived;
        const llUrl = new URL("https://graph.instagram.com/access_token");
        llUrl.searchParams.set("grant_type", "ig_exchange_token");
        llUrl.searchParams.set("client_secret", instagramAppSecret);
        llUrl.searchParams.set("access_token", shortLived);
        let llRes: Response;
        try {
          llRes = await fetch(llUrl.toString());
        } catch (e) {
          console.error("[connected-accounts/callback] Instagram long-lived token fetch threw:", e);
          accessToken = longLivedToken;
          break;
        }
        const llData = (await llRes.json().catch(() => ({}))) as {
          access_token?: string;
          expires_in?: number;
          error?: { message?: string };
        };
        if (llRes.ok && llData.access_token) {
          longLivedToken = llData.access_token;
          if (llData.expires_in) {
            const d = new Date();
            d.setSeconds(d.getSeconds() + llData.expires_in);
            expiresAt = d;
          }
          console.log("[connected-accounts/callback] Instagram long-lived exchange OK:", {
            expiresIn: llData.expires_in ?? null,
          });
        } else {
          console.warn("[connected-accounts/callback] Instagram long-lived exchange failed (using short-lived):", {
            httpStatus: llRes.status,
            error: llData.error?.message ?? (llData as { error_message?: string }).error_message ?? llRes.statusText,
            bodyKeys: Object.keys(llData),
          });
        }
        accessToken = longLivedToken;

        try {
          const meUrl = new URL("https://graph.instagram.com/v21.0/me");
          meUrl.searchParams.set("fields", "id,username");
          meUrl.searchParams.set("access_token", longLivedToken);
          const meRes = await fetch(meUrl.toString());
          const meData = (await meRes.json().catch(() => ({}))) as {
            id?: string;
            username?: string;
            error?: { message?: string };
          };
          console.log("[connected-accounts/callback] Instagram /me:", {
            ok: meRes.ok,
            status: meRes.status,
            error: meData.error?.message,
            hasUsername: Boolean(meData.username),
          });
          if (meRes.ok && typeof meData.username === "string" && meData.username.trim()) {
            platformUsername = meData.username.trim();
          }
          if (meRes.ok && typeof meData.id === "string" && !platformUserId) {
            platformUserId = meData.id;
          }
        } catch (e) {
          console.warn("[connected-accounts/callback] Could not fetch Instagram profile", e);
        }
        break;
      }
      case "facebook": {
        const facebookAppId = process.env.FACEBOOK_APP_ID?.trim() ?? "";
        const facebookAppSecret = process.env.FACEBOOK_APP_SECRET?.trim() ?? "";
        if (!facebookAppId || !facebookAppSecret) {
          return errorRedirect("Facebook OAuth not configured.");
        }
        console.log("[connected-accounts/callback] Facebook Login token exchange:", {
          endpoint: "graph.facebook.com/v21.0/oauth/access_token",
          client_id: facebookAppId,
          redirect_uri: callbackUrl,
        });
        const res = await fetch(
          `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${encodeURIComponent(facebookAppId)}&client_secret=${encodeURIComponent(facebookAppSecret)}&redirect_uri=${encodeURIComponent(callbackUrl)}&code=${encodeURIComponent(code)}`
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

    let existing: SelectConnectedAccount[];
    try {
      existing = await db
        .select()
        .from(connectedAccountsTable)
        .where(
          and(
            eq(connectedAccountsTable.userId, userId),
            eq(connectedAccountsTable.platform, platform)
          )
        );
    } catch (e) {
      console.error("[connected-accounts/callback] DB select connected_accounts failed:", {
        platform,
        userIdPrefix: userId.slice(0, 12),
        err: e,
      });
      throw e;
    }

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

    const matchedExisting =
      (platform === "youtube" || platform === "instagram") && platformUserId
        ? existing.find((r) => (r.platformUserId ?? null) === platformUserId) ?? null
        : existing[0] ?? null;

    console.log("[connected-accounts/callback] Persisting connected_accounts:", {
      platform,
      existingCount: existing.length,
      matchedExistingId: matchedExisting?.id ?? null,
      platformUserId: row.platformUserId ?? null,
      willUpdate: Boolean(matchedExisting),
    });

    try {
      if (matchedExisting) {
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
              eq(connectedAccountsTable.platform, platform),
              eq(connectedAccountsTable.id, matchedExisting.id)
            )
          );
        console.log("[connected-accounts/callback] Updated connected_accounts row:", matchedExisting.id);
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
        console.log("[connected-accounts/callback] Inserted connected_accounts for platform:", platform);
      }
    } catch (e) {
      console.error("[connected-accounts/callback] DB insert/update connected_accounts failed:", {
        platform,
        userIdPrefix: userId.slice(0, 12),
        matchedExistingId: matchedExisting?.id ?? null,
        err: e,
      });
      throw e;
    }

    return successRedirect();
  } catch (err) {
    console.error("[connected-accounts/callback]", err);
    return errorRedirect(
      err instanceof Error ? err.message : "Connection failed."
    );
  }
}
