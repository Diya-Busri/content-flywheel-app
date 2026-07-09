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
import { INSTAGRAM_FACEBOOK_CONNECT_SCOPES } from "@/lib/instagram-facebook-connect-scopes";

export const dynamic = "force-dynamic";

const PLATFORMS: ConnectedPlatform[] = ["tiktok", "youtube", "instagram", "facebook", "linkedin", "x"];

function getRedirectUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/dashboard/settings/connected-accounts`;
}

function getPlatformFromState(state: string | null): { platform: ConnectedPlatform | null; forceNew: boolean } {
  if (!state) return { platform: null, forceNew: false };
  const parts = state.split(":");
  const raw = parts[0];
  // State format: "platform:random" or "platform:new:random" (new = force insert)
  const forceNew = parts[1] === "new";
  const platform = PLATFORMS.includes(raw as ConnectedPlatform) ? (raw as ConnectedPlatform) : null;
  return { platform, forceNew };
}

/**
 * Match DB row for Instagram reconnect: same IG business id, or a single legacy row with null platform_user_id.
 */
function matchInstagramExistingRow(
  existing: SelectConnectedAccount[],
  igBusinessAccountId: string | null
): SelectConnectedAccount | null {
  if (!igBusinessAccountId) return null;
  const byId = existing.find((r) => (r.platformUserId ?? null) === igBusinessAccountId);
  if (byId) return byId;
  if (existing.length === 1) {
    const only = existing[0];
    if (only && (only.platformUserId == null || String(only.platformUserId).trim() === "")) {
      return only;
    }
  }
  return null;
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
    const { platform, forceNew } = getPlatformFromState(state);
    const code = searchParams.get("code");
    const errorParam = searchParams.get("error");

    console.log("[connected-accounts/callback] Incoming OAuth callback:", {
      pathname: new URL(request.url).pathname,
      platformFromState: platform,
      forceNew,
      statePrefix: state?.split(":")[0] ?? null,
      stateLength: state?.length ?? 0,
      stateSample: state ? `${state.slice(0, 48)}${state.length > 48 ? "…" : ""}` : null,
      hasCode: Boolean(code),
      codeLength: code?.length ?? 0,
      errorParam,
      userIdPrefix: userId.slice(0, 12),
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
        const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim() ?? "";
        const clientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim() ?? "";
        if (!clientKey || !clientSecret) {
          return errorRedirect("TikTok OAuth not configured.");
        }
        console.log("[connected-accounts/callback] TikTok token exchange redirect_uri:", callbackUrl, {
          x_forwarded_host: request.headers.get("x-forwarded-host"),
          host: request.headers.get("host"),
        });
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
        const data = (await res.json().catch(() => ({}))) as {
          access_token?: string;
          refresh_token?: string;
          expires_in?: number;
          open_id?: string;
          error?: string;
          error_description?: string;
          description?: string;
        };
        if (!res.ok || !data.access_token) {
          const msg =
            typeof data.error_description === "string" && data.error_description.trim().length > 0
              ? data.error_description
              : typeof data.description === "string"
                ? data.description
                : typeof data.error === "string"
                  ? data.error
                  : "TikTok token exchange failed.";
          console.error("[connected-accounts/callback] TikTok token exchange failed:", {
            status: res.status,
            body: { ...data, access_token: data.access_token ? "[REDACTED]" : undefined },
          });
          return errorRedirect(msg);
        }
        accessToken = data.access_token;
        refreshToken = data.refresh_token || null;
        if (data.expires_in) {
          const d = new Date();
          d.setSeconds(d.getSeconds() + data.expires_in);
          expiresAt = d;
        }
        if (typeof data.open_id === "string" && data.open_id.trim().length > 0) {
          platformUserId = data.open_id.trim();
        }
        try {
          const userInfoUrl =
            "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url";
          const meRes = await fetch(userInfoUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const meData = (await meRes.json().catch(() => ({}))) as {
            data?: { user?: { open_id?: string; display_name?: string; avatar_url?: string } };
            error?: { code?: string; message?: string };
          };
          const u = meData.data?.user;
          if (meRes.ok && u) {
            if (typeof u.open_id === "string" && u.open_id.trim().length > 0) {
              platformUserId = u.open_id.trim();
            }
            platformUsername =
              typeof u.display_name === "string" && u.display_name.trim().length > 0
                ? u.display_name.trim()
                : null;
          } else {
            console.warn("[connected-accounts/callback] TikTok user/info not ok or missing user:", {
              status: meRes.status,
              error: meData.error,
            });
          }
        } catch (e) {
          console.warn("[connected-accounts/callback] Could not fetch TikTok user info", e);
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
        const facebookAppId = process.env.FACEBOOK_APP_ID?.trim() ?? "";
        const facebookAppSecret = process.env.FACEBOOK_APP_SECRET?.trim() ?? "";
        if (!facebookAppId || !facebookAppSecret) {
          return errorRedirect("Facebook app not configured. Set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET for Instagram.");
        }

        const tokenUrl =
          `https://graph.facebook.com/v21.0/oauth/access_token?` +
          `client_id=${encodeURIComponent(facebookAppId)}` +
          `&client_secret=${encodeURIComponent(facebookAppSecret)}` +
          `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
          `&code=${encodeURIComponent(code)}`;
        const tokenRes = await fetch(tokenUrl);
        const tokenRawText = await tokenRes.text();
        let tokenData: {
          access_token?: string;
          expires_in?: number;
          error?: { message?: string };
        };
        try {
          tokenData = tokenRawText ? (JSON.parse(tokenRawText) as typeof tokenData) : {};
        } catch {
          tokenData = {};
          console.error("[connected-accounts/callback] Instagram: token exchange body not JSON:", tokenRawText.slice(0, 800));
        }
        console.log("[connected-accounts/callback] Instagram: short-lived user token exchange:", {
          ok: tokenRes.ok,
          status: tokenRes.status,
          redirect_uri_used: callbackUrl,
          body_redacted: { ...tokenData, access_token: tokenData.access_token ? "[REDACTED]" : undefined },
          raw_length: tokenRawText.length,
        });
        if (!tokenRes.ok || !tokenData.access_token) {
          console.error("[connected-accounts/callback] Instagram: token exchange failed full body:", tokenRawText.slice(0, 2000));
          return errorRedirect(tokenData.error?.message || "Facebook token exchange failed.");
        }

        let userAccessToken = tokenData.access_token;
        if (tokenData.expires_in) {
          const d = new Date();
          d.setSeconds(d.getSeconds() + Number(tokenData.expires_in));
          expiresAt = d;
        }

        const llUrl =
          `https://graph.facebook.com/v21.0/oauth/access_token?` +
          `grant_type=fb_exchange_token` +
          `&client_id=${encodeURIComponent(facebookAppId)}` +
          `&client_secret=${encodeURIComponent(facebookAppSecret)}` +
          `&fb_exchange_token=${encodeURIComponent(userAccessToken)}`;
        const llRes = await fetch(llUrl);
        const llRawText = await llRes.text();
        let llData: {
          access_token?: string;
          expires_in?: number;
          error?: { message?: string };
        };
        try {
          llData = llRawText ? (JSON.parse(llRawText) as typeof llData) : {};
        } catch {
          llData = {};
          console.error("[connected-accounts/callback] Instagram: long-lived response not JSON:", llRawText.slice(0, 800));
        }
        console.log("[connected-accounts/callback] Instagram: long-lived user token exchange:", {
          ok: llRes.ok,
          status: llRes.status,
          body: { ...llData, access_token: llData.access_token ? "[REDACTED]" : undefined },
          raw_length: llRawText.length,
        });
        if (llRes.ok && llData.access_token) {
          userAccessToken = llData.access_token;
          if (llData.expires_in) {
            const d = new Date();
            d.setSeconds(d.getSeconds() + Number(llData.expires_in));
            expiresAt = d;
          }
        } else {
          console.warn("[connected-accounts/callback] Instagram: long-lived exchange failed; using short-lived user token for /me/accounts");
        }

        const accountsUrl =
          `https://graph.facebook.com/v21.0/me/accounts?` +
          `fields=name,id,access_token` +
          `&access_token=${encodeURIComponent(userAccessToken)}`;
        const accRes = await fetch(accountsUrl);
        const accText = await accRes.text();
        let accJson: {
          data?: Array<{
            id?: string;
            name?: string;
            access_token?: string;
          }>;
          error?: { message?: string };
        };
        try {
          accJson = accText ? (JSON.parse(accText) as typeof accJson) : {};
        } catch {
          accJson = {};
          console.error("[connected-accounts/callback] Instagram: /me/accounts not JSON:", accText.slice(0, 500));
        }
        console.log("[connected-accounts/callback] Instagram: GET /me/accounts full response:", accText.slice(0, 12000));
        if (accJson.error?.message) {
          console.error("[connected-accounts/callback] Instagram: /me/accounts Graph error:", accJson.error);
        }

        const pages = Array.isArray(accJson.data) ? accJson.data : [];
        console.log("[connected-accounts/callback] Instagram: pages count:", pages.length);

        type ResolvedIg = {
          accessToken: string;
          platformUserId: string;
          platformUsername: string | null;
          source: "page" | "facebook_me" | "instagram_me";
        };
        let resolved: ResolvedIg | null = null;

        for (const p of pages) {
          const pageId = typeof p.id === "string" ? p.id : null;
          const pageToken = typeof p.access_token === "string" ? p.access_token : null;
          if (!pageId || !pageToken) continue;

          const igUrl =
            `https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}?` +
            `fields=instagram_business_account{id,username}` +
            `&access_token=${encodeURIComponent(pageToken)}`;
          const igRes = await fetch(igUrl);
          const igText = await igRes.text();
          console.log(
            `[connected-accounts/callback] Instagram: GET /${pageId}?fields=instagram_business_account status=${igRes.status} body:`,
            igText.slice(0, 4000)
          );
          let igJson: {
            instagram_business_account?: { id?: string; username?: string };
            error?: { message?: string };
          };
          try {
            igJson = igText ? (JSON.parse(igText) as typeof igJson) : {};
          } catch {
            igJson = {};
          }
          const igId = igJson.instagram_business_account?.id;
          if (igId) {
            resolved = {
              accessToken: pageToken,
              platformUserId: String(igId),
              platformUsername:
                igJson.instagram_business_account?.username?.trim() || p.name?.trim() || null,
              source: "page",
            };
            break;
          }
        }

        if (!resolved && pages.length === 0) {
          const fbMeUrl =
            `https://graph.facebook.com/v21.0/me?fields=id,name,instagram_business_account{id,username}` +
            `&access_token=${encodeURIComponent(userAccessToken)}`;
          const fbMeRes = await fetch(fbMeUrl);
          const fbMeText = await fbMeRes.text();
          console.log(
            "[connected-accounts/callback] Instagram: fallback GET graph.facebook.com/me (empty /me/accounts):",
            { status: fbMeRes.status, body: fbMeText.slice(0, 4000) }
          );
          let fbMeJson: {
            id?: string;
            name?: string;
            instagram_business_account?: { id?: string; username?: string };
            error?: { message?: string };
          };
          try {
            fbMeJson = fbMeText ? (JSON.parse(fbMeText) as typeof fbMeJson) : {};
          } catch {
            fbMeJson = {};
          }
          const igBiz = fbMeJson.instagram_business_account;
          if (igBiz?.id) {
            resolved = {
              accessToken: userAccessToken,
              platformUserId: String(igBiz.id),
              platformUsername: igBiz.username?.trim() || fbMeJson.name?.trim() || null,
              source: "facebook_me",
            };
            console.log("[connected-accounts/callback] Instagram: resolved via graph.facebook.com/me");
          }
        }

        if (!resolved) {
          const igMeUrl =
            `https://graph.instagram.com/v21.0/me?fields=id,username` +
            `&access_token=${encodeURIComponent(userAccessToken)}`;
          const igMeRes = await fetch(igMeUrl);
          const igMeText = await igMeRes.text();
          console.log("[connected-accounts/callback] Instagram: fallback GET graph.instagram.com/me:", {
            status: igMeRes.status,
            body: igMeText.slice(0, 4000),
          });
          let igMeJson: { id?: string; username?: string; error?: { message?: string } };
          try {
            igMeJson = igMeText ? (JSON.parse(igMeText) as typeof igMeJson) : {};
          } catch {
            igMeJson = {};
          }
          if (igMeJson.id) {
            resolved = {
              accessToken: userAccessToken,
              platformUserId: String(igMeJson.id),
              platformUsername: igMeJson.username?.trim() || null,
              source: "instagram_me",
            };
            console.log("[connected-accounts/callback] Instagram: resolved via graph.instagram.com/me");
          }
        }

        if (!resolved) {
          return errorRedirect(
            "Could not resolve an Instagram account. Link Instagram to a Facebook Page (Meta Business Suite), or ensure your Facebook login has access to the Instagram professional account."
          );
        }

        accessToken = resolved.accessToken;
        platformUserId = resolved.platformUserId;
        platformUsername = resolved.platformUsername;
        refreshToken = null;

        console.log("[connected-accounts/callback] Instagram: stored token + user id:", {
          source: resolved.source,
          platformUserId,
          username: platformUsername,
          tokenKind: resolved.source === "page" ? "page_access_token" : "user_access_token",
        });
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
      case "linkedin": {
        const clientId     = process.env.LINKEDIN_CLIENT_ID?.trim()     ?? "";
        const clientSecret = process.env.LINKEDIN_CLIENT_SECRET?.trim() ?? "";
        if (!clientId || !clientSecret) return errorRedirect("LinkedIn OAuth not configured.");

        const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
          method:  "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body:    new URLSearchParams({
            grant_type:    "authorization_code",
            code,
            redirect_uri:  callbackUrl,
            client_id:     clientId,
            client_secret: clientSecret,
          }),
        });
        const data = await res.json().catch(() => ({})) as {
          access_token?: string;
          refresh_token?: string;
          expires_in?: number;
          error_description?: string;
        };
        if (!res.ok || !data.access_token) {
          return errorRedirect(data.error_description ?? "LinkedIn token exchange failed.");
        }
        accessToken  = data.access_token;
        refreshToken = data.refresh_token ?? null;
        if (data.expires_in) {
          const d = new Date();
          d.setSeconds(d.getSeconds() + data.expires_in);
          expiresAt = d;
        }
        // Fetch profile
        try {
          const meRes  = await fetch("https://api.linkedin.com/v2/me", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const me = await meRes.json().catch(() => ({})) as { id?: string; localizedFirstName?: string; localizedLastName?: string };
          platformUserId   = me.id ?? null;
          platformUsername = (me.localizedFirstName && me.localizedLastName)
            ? `${me.localizedFirstName} ${me.localizedLastName}`
            : null;
        } catch { /* no profile — fine */ }
        break;
      }
      case "x": {
        const clientId     = process.env.X_CLIENT_ID?.trim()     ?? "";
        const clientSecret = process.env.X_CLIENT_SECRET?.trim() ?? "";
        if (!clientId || !clientSecret) return errorRedirect("X OAuth not configured.");

        // PKCE — code_verifier was packed into state as last segment
        const stateParts    = state?.split(":") ?? [];
        const codeVerifier  = stateParts[stateParts.length - 1] ?? "";

        const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
        const res = await fetch("https://api.twitter.com/2/oauth2/token", {
          method:  "POST",
          headers: {
            Authorization:  `Basic ${credentials}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            code,
            grant_type:    "authorization_code",
            redirect_uri:  callbackUrl,
            code_verifier: codeVerifier,
          }),
        });
        const data = await res.json().catch(() => ({})) as {
          access_token?: string;
          refresh_token?: string;
          expires_in?: number;
          error_description?: string;
        };
        if (!res.ok || !data.access_token) {
          return errorRedirect(data.error_description ?? "X token exchange failed.");
        }
        accessToken  = data.access_token;
        refreshToken = data.refresh_token ?? null;
        if (data.expires_in) {
          const d = new Date();
          d.setSeconds(d.getSeconds() + data.expires_in);
          expiresAt = d;
        }
        // Fetch user identity
        try {
          const meRes = await fetch("https://api.twitter.com/2/users/me?user.fields=username,name", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const me = await meRes.json().catch(() => ({})) as { data?: { id?: string; username?: string; name?: string } };
          platformUserId   = me.data?.id       ?? null;
          platformUsername = me.data?.username  ? `@${me.data.username}` : null;
        } catch { /* no profile — fine */ }
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
      console.log("[connected-accounts/callback] DB select ok:", {
        platform,
        rowCount: existing.length,
        existingSummaries: existing.map((r) => ({
          id: r.id,
          platformUserId: r.platformUserId ?? "(null)",
          hasToken: Boolean(r.accessToken?.length),
        })),
        hasDatabaseUrl: Boolean(process.env.DATABASE_URL?.trim()),
      });
    } catch (e) {
      console.error("[connected-accounts/callback] DB select connected_accounts failed:", {
        platform,
        userIdPrefix: userId.slice(0, 12),
        message: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
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

    // YouTube: ALWAYS insert a new row (never update existing).
    // Google brand account OAuth returns the same primary channel ID regardless of which
    // brand was selected, so matching by platformUserId would always overwrite the first
    // channel. We store the token with null platformUserId (bypassing the unique constraint)
    // and show a channel picker modal so the user can set the correct handle.
    //
    // Other platforms: match existing row (update token) or insert if new.
    const matchedExisting =
      platform === "youtube"
        ? null
        : platform === "instagram"
          ? matchInstagramExistingRow(existing, platformUserId)
          : (platform === "tiktok") && platformUserId
            ? existing.find((r) => (r.platformUserId ?? null) === platformUserId) ?? null
            : existing[0] ?? null;

    console.log("[connected-accounts/callback] Persisting connected_accounts:", {
      platform,
      forceNew,
      existingCount: existing.length,
      matchedExistingId: matchedExisting?.id ?? null,
      platformUserId: row.platformUserId ?? null,
      willUpdate: Boolean(matchedExisting),
      willInsert: !matchedExisting,
    });

    let savedRowId: string | null = null;

    try {
      if (matchedExisting) {
        const updated = await db
          .update(connectedAccountsTable)
          .set({
            accessToken: row.accessToken,
            refreshToken: row.refreshToken ?? null,
            expiresAt: row.expiresAt,
            platformUserId: row.platformUserId ?? null,
            platformUsername: row.platformUsername ?? null,
            updatedAt: row.updatedAt,
            ...(platform === "instagram" ? { scopes: INSTAGRAM_FACEBOOK_CONNECT_SCOPES } : {}),
          })
          .where(
            and(
              eq(connectedAccountsTable.userId, userId),
              eq(connectedAccountsTable.platform, platform),
              eq(connectedAccountsTable.id, matchedExisting.id)
            )
          )
          .returning({ id: connectedAccountsTable.id });
        savedRowId = updated[0]?.id ?? null;
        console.log("[connected-accounts/callback] Updated connected_accounts:", {
          id: matchedExisting.id,
          returning: updated,
        });
      } else {
        // YouTube always inserts with null platformUserId to avoid unique constraint issues.
        // The channel picker modal lets the user set the correct handle afterwards.
        const insertPlatformUserId = platform === "youtube" ? null : (row.platformUserId ?? null);
        const insertPlatformUsername = platform === "youtube" ? null : (row.platformUsername ?? null);

        let inserted: { id: string }[] = [];
        try {
          inserted = await db
            .insert(connectedAccountsTable)
            .values({
              userId: row.userId,
              platform: row.platform,
              accessToken: row.accessToken,
              refreshToken: row.refreshToken ?? null,
              expiresAt: row.expiresAt,
              platformUserId: insertPlatformUserId,
              platformUsername: insertPlatformUsername,
              ...(platform === "instagram" ? { scopes: INSTAGRAM_FACEBOOK_CONNECT_SCOPES } : {}),
            })
            .returning({ id: connectedAccountsTable.id });
        } catch (insertErr) {
          const code = insertErr && typeof insertErr === "object" && "code" in insertErr
            ? (insertErr as { code?: string }).code : undefined;
          if (code === "23505") {
            // Unique constraint — retry with null IDs
            console.warn("[connected-accounts/callback] Unique constraint on insert — retrying with null IDs");
            inserted = await db
              .insert(connectedAccountsTable)
              .values({
                userId: row.userId,
                platform: row.platform,
                accessToken: row.accessToken,
                refreshToken: row.refreshToken ?? null,
                expiresAt: row.expiresAt,
                platformUserId: null,
                platformUsername: null,
                ...(platform === "instagram" ? { scopes: INSTAGRAM_FACEBOOK_CONNECT_SCOPES } : {}),
              })
              .returning({ id: connectedAccountsTable.id });
          } else {
            throw insertErr;
          }
        }
        savedRowId = inserted[0]?.id ?? null;
        console.log("[connected-accounts/callback] Inserted connected_accounts:", { platform, forceNew, returning: inserted });
      }
    } catch (e) {
      console.error("[connected-accounts/callback] DB insert/update connected_accounts failed:", {
        platform,
        userIdPrefix: userId.slice(0, 12),
        matchedExistingId: matchedExisting?.id ?? null,
        message: e instanceof Error ? e.message : String(e),
        code: e && typeof e === "object" && "code" in e ? (e as { code?: string }).code : undefined,
        stack: e instanceof Error ? e.stack : undefined,
        err: e,
      });
      throw e;
    }

    // For YouTube new connections: redirect to channel picker so user can confirm
    // which brand channel this token is for (Google brand account OAuth often returns
    // the primary channel from channels?mine=true regardless of which brand was selected)
    if (platform === "youtube" && savedRowId && !matchedExisting) {
      const detected = encodeURIComponent(platformUsername ?? "");
      return NextResponse.redirect(
        `${redirectUrl}?yt_new=${encodeURIComponent(savedRowId)}&yt_detected=${detected}`
      );
    }

    return successRedirect();
  } catch (err) {
    console.error("[connected-accounts/callback]", err);
    return errorRedirect(
      err instanceof Error ? err.message : "Connection failed."
    );
  }
}
