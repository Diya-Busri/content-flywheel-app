import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/db";
import { connectedAccountsTable } from "@/db/schema/connected-accounts-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Allow up to 5 minutes for large video uploads
export const maxDuration = 300;

type TokenRefreshResponse = {
  access_token?: string;
  expires_in?: number;
};

async function refreshYoutubeAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: Date | null }> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error("Google OAuth is not configured.");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as TokenRefreshResponse;
  if (!res.ok || !data.access_token) throw new Error("Failed to refresh YouTube access token.");
  const expiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null;
  return { accessToken: data.access_token, expiresAt };
}

/**
 * POST /api/youtube/post-from-url
 * Upload a video to YouTube from a publicly accessible URL (e.g. Supabase storage).
 *
 * Body (JSON):
 *   youtubeAccountId: string
 *   videoUrl: string          — publicly accessible mp4 URL
 *   title: string
 *   description?: string
 *   keywords?: string         — comma-separated
 *   scheduledAt: string       — ISO datetime; set to future for scheduled, past/now for immediate
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({})) as {
      youtubeAccountId?: string;
      videoUrl?: string;
      title?: string;
      description?: string;
      keywords?: string;
      scheduledAt?: string;
    };

    const { youtubeAccountId, videoUrl, title, description = "", keywords = "", scheduledAt } = body;

    if (!youtubeAccountId?.trim()) {
      return NextResponse.json({ error: "youtubeAccountId is required." }, { status: 400 });
    }
    if (!videoUrl?.trim()) {
      return NextResponse.json({ error: "videoUrl is required." }, { status: 400 });
    }
    if (!title?.trim()) {
      return NextResponse.json({ error: "title is required." }, { status: 400 });
    }
    if (!scheduledAt?.trim()) {
      return NextResponse.json({ error: "scheduledAt is required." }, { status: 400 });
    }

    const scheduledDate = new Date(scheduledAt);
    if (Number.isNaN(scheduledDate.getTime())) {
      return NextResponse.json({ error: "Invalid scheduledAt datetime." }, { status: 400 });
    }

    // Look up the YouTube connected account
    const [account] = await db
      .select()
      .from(connectedAccountsTable)
      .where(
        and(
          eq(connectedAccountsTable.id, youtubeAccountId),
          eq(connectedAccountsTable.userId, userId),
          eq(connectedAccountsTable.platform, "youtube")
        )
      )
      .limit(1);

    if (!account) {
      return NextResponse.json({ error: "YouTube account not found." }, { status: 404 });
    }

    // Refresh token if needed
    let accessToken = account.accessToken;
    const expiresAtMs = account.expiresAt ? new Date(account.expiresAt).getTime() : null;
    if (expiresAtMs && expiresAtMs < Date.now() + 60_000) {
      if (!account.refreshToken) {
        return NextResponse.json({ error: "YouTube token expired. Please reconnect your account." }, { status: 401 });
      }
      const refreshed = await refreshYoutubeAccessToken(account.refreshToken);
      accessToken = refreshed.accessToken;
      await db
        .update(connectedAccountsTable)
        .set({ accessToken: refreshed.accessToken, expiresAt: refreshed.expiresAt, updatedAt: new Date() })
        .where(eq(connectedAccountsTable.id, account.id));
    }

    // Fetch the video from the URL
    console.log("[youtube/post-from-url] Fetching video from:", videoUrl);
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) {
      return NextResponse.json(
        { error: `Failed to fetch video from URL (${videoRes.status}). Make sure the video is publicly accessible.` },
        { status: 400 }
      );
    }

    const contentType = videoRes.headers.get("content-type") ?? "video/mp4";
    const contentLength = videoRes.headers.get("content-length");
    const videoBytes = Buffer.from(await videoRes.arrayBuffer());
    console.log("[youtube/post-from-url] Video size:", videoBytes.length, "bytes");

    const tags = keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)
      .slice(0, 30);

    // Determine if this is immediate or scheduled
    const isScheduled = scheduledDate.getTime() > Date.now() + 30_000; // >30s in future = scheduled
    const privacyStatus = isScheduled ? "private" : "public";

    // Initiate YouTube resumable upload
    const initBody: Record<string, unknown> = {
      snippet: {
        title: title.trim().slice(0, 100),
        description: description.slice(0, 5000),
        tags,
      },
      status: {
        privacyStatus,
        selfDeclaredMadeForKids: false,
        ...(isScheduled ? { publishAt: scheduledDate.toISOString() } : {}),
      },
    };

    const initRes = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": contentType.startsWith("video/") ? contentType : "video/mp4",
          "X-Upload-Content-Length": String(contentLength ?? videoBytes.length),
        },
        body: JSON.stringify(initBody),
      }
    );

    if (!initRes.ok) {
      const errText = await initRes.text().catch(() => "");
      return NextResponse.json(
        { error: `YouTube upload init failed: ${errText || initRes.status}` },
        { status: 502 }
      );
    }

    const uploadUrl = initRes.headers.get("location");
    if (!uploadUrl) {
      return NextResponse.json({ error: "YouTube resumable upload URL missing." }, { status: 502 });
    }

    // Upload the video bytes
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType.startsWith("video/") ? contentType : "video/mp4",
        "Content-Length": String(videoBytes.length),
      },
      body: videoBytes,
    });

    const uploadJson = (await uploadRes.json().catch(() => ({}))) as { id?: string; error?: unknown };
    if (!uploadRes.ok || !uploadJson.id) {
      const errDetail = typeof uploadJson.error === "object"
        ? JSON.stringify(uploadJson.error)
        : String(uploadJson.error ?? uploadRes.status);
      return NextResponse.json({ error: `YouTube upload failed: ${errDetail}` }, { status: 502 });
    }

    const videoId = uploadJson.id;
    console.log("[youtube/post-from-url] Uploaded video ID:", videoId);

    return NextResponse.json({
      youtubeVideoId: videoId,
      watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
      studioUrl: `https://studio.youtube.com/video/${videoId}/edit`,
      scheduledAt: scheduledDate.toISOString(),
      immediate: !isScheduled,
    });
  } catch (err) {
    console.error("[youtube/post-from-url]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to post to YouTube" },
      { status: 500 }
    );
  }
}
