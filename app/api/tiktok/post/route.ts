import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { connectedAccountsTable } from "@/db/schema/connected-accounts-schema";
import { eq, and } from "drizzle-orm";
import { checkApiRateLimit } from "@/lib/rate-limit-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Refresh a TikTok access token and persist the new one. Returns the fresh access token. */
async function refreshTikTokToken(refreshToken: string, accountRowId: string): Promise<string> {
  const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim() ?? "";
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim() ?? "";
  if (!clientKey || !clientSecret) throw new Error("TikTok OAuth credentials not configured.");

  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description ?? data.error ?? "TikTok token refresh failed.");
  }
  const expiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null;
  await db
    .update(connectedAccountsTable)
    .set({
      accessToken: data.access_token,
      ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
      ...(expiresAt ? { expiresAt } : {}),
      updatedAt: new Date(),
    })
    .where(eq(connectedAccountsTable.id, accountRowId));
  return data.access_token;
}

/**
 * POST /api/tiktok/post
 * Upload a video to TikTok via the Content Posting API (PULL_FROM_URL).
 * Body: { videoUrl: string; title: string; privacyLevel?: string; accountId?: string }
 * Returns: { publishId: string } or error.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const body = (await request.json().catch(() => ({}))) as {
      videoUrl?: string;
      title?: string;
      privacyLevel?: string;
      accountId?: string;
    };

    const videoUrl = typeof body.videoUrl === "string" ? body.videoUrl.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 150) : "";
    // Conservative default — user can change in TikTok after posting
    const privacyLevel = ["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_CREATOR", "SELF_ONLY"]
      .includes(body.privacyLevel ?? "")
      ? (body.privacyLevel as string)
      : "SELF_ONLY";

    if (!videoUrl) return NextResponse.json({ error: "videoUrl is required." }, { status: 400 });
    if (!title) return NextResponse.json({ error: "title is required." }, { status: 400 });

    // Fetch the connected TikTok account
    const whereConditions = [
      eq(connectedAccountsTable.userId, userId),
      eq(connectedAccountsTable.platform, "tiktok"),
    ];
    if (typeof body.accountId === "string" && body.accountId.trim()) {
      whereConditions.push(eq(connectedAccountsTable.id, body.accountId.trim()));
    }
    const accounts = await db
      .select()
      .from(connectedAccountsTable)
      .where(and(...whereConditions))
      .limit(1);

    const account = accounts[0];
    if (!account) {
      return NextResponse.json(
        {
          error:
            "No TikTok account connected. Go to Settings → Connected accounts to link your TikTok.",
        },
        { status: 404 }
      );
    }

    // Refresh token if expired or expiring within 60 s
    let accessToken = account.accessToken;
    if (account.expiresAt && account.expiresAt.getTime() - Date.now() < 60_000) {
      if (!account.refreshToken) {
        return NextResponse.json(
          {
            error:
              "TikTok access token has expired and cannot be refreshed. Reconnect your TikTok account in Settings → Connected accounts.",
          },
          { status: 401 }
        );
      }
      accessToken = await refreshTikTokToken(account.refreshToken, account.id);
    }

    // TikTok Content Posting API — PULL_FROM_URL (TikTok fetches the video from the URL)
    const postRes = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        post_info: {
          title,
          privacy_level: privacyLevel,
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
          video_cover_timestamp_ms: 1000,
        },
        source_info: {
          source: "PULL_FROM_URL",
          video_url: videoUrl,
        },
      }),
    });

    const postData = (await postRes.json().catch(() => ({}))) as {
      data?: { publish_id?: string };
      error?: { code?: string; message?: string; log_id?: string };
    };

    const errCode = postData.error?.code ?? "";
    const errMsg = postData.error?.message ?? `TikTok API error (HTTP ${postRes.status})`;

    if (!postRes.ok || (errCode !== "ok" && errCode !== "")) {
      if (errCode === "access_token_invalid" || errCode === "access_token_expired") {
        return NextResponse.json(
          {
            error:
              "TikTok token is invalid. Reconnect your TikTok account in Settings → Connected accounts.",
          },
          { status: 401 }
        );
      }
      if (errCode === "scope_not_authorized") {
        return NextResponse.json(
          {
            error:
              "Your TikTok connection is missing the video.publish permission. Reconnect TikTok in Settings → Connected accounts to grant posting access.",
          },
          { status: 403 }
        );
      }
      console.error("[tiktok/post] TikTok API rejected:", { status: postRes.status, errCode, errMsg });
      return NextResponse.json({ error: errMsg, code: errCode }, { status: 502 });
    }

    const publishId = postData.data?.publish_id ?? null;
    return NextResponse.json({ publishId, ok: true });
  } catch (err) {
    console.error("[tiktok/post]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to post to TikTok" },
      { status: 500 }
    );
  }
}
