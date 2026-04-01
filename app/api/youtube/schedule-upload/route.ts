import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/db";
import { connectedAccountsTable } from "@/db/schema/connected-accounts-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TokenRefreshResponse = {
  access_token?: string;
  expires_in?: number;
};

async function refreshYoutubeAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date | null }> {
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

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const form = await request.formData();
    const youtubeAccountId = String(form.get("youtubeAccountId") ?? "").trim();
    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const keywordsRaw = String(form.get("keywords") ?? "").trim();
    const scheduledAtRaw = String(form.get("scheduledAt") ?? "").trim();
    const file = form.get("videoFile");

    if (!youtubeAccountId || !title || !scheduledAtRaw) {
      return NextResponse.json({ error: "youtubeAccountId, title, scheduledAt required." }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "videoFile is required (mp4)." }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "videoFile is empty." }, { status: 400 });
    }

    const scheduledAt = new Date(scheduledAtRaw);
    if (Number.isNaN(scheduledAt.getTime())) {
      return NextResponse.json({ error: "Invalid scheduledAt datetime." }, { status: 400 });
    }

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

    let accessToken = account.accessToken;
    const expiresAtMs = account.expiresAt ? new Date(account.expiresAt).getTime() : null;
    if (expiresAtMs && expiresAtMs < Date.now() + 60_000) {
      if (!account.refreshToken) {
        return NextResponse.json({ error: "YouTube token expired; reconnect account." }, { status: 401 });
      }
      const refreshed = await refreshYoutubeAccessToken(account.refreshToken);
      accessToken = refreshed.accessToken;
      await db
        .update(connectedAccountsTable)
        .set({
          accessToken: refreshed.accessToken,
          expiresAt: refreshed.expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(connectedAccountsTable.id, account.id));
    }

    const keywords = keywordsRaw
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)
      .slice(0, 30);

    const initRes = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": file.type || "video/mp4",
          "X-Upload-Content-Length": String(file.size),
        },
        body: JSON.stringify({
          snippet: {
            title: title.slice(0, 100),
            description: description.slice(0, 5000),
            tags: keywords,
          },
          status: {
            privacyStatus: "private",
            publishAt: scheduledAt.toISOString(),
            selfDeclaredMadeForKids: false,
          },
        }),
      }
    );

    if (!initRes.ok) {
      const errText = await initRes.text().catch(() => "");
      return NextResponse.json({ error: `YouTube init upload failed: ${errText || initRes.status}` }, { status: 502 });
    }

    const uploadUrl = initRes.headers.get("location");
    if (!uploadUrl) {
      return NextResponse.json({ error: "YouTube resumable upload URL missing." }, { status: 502 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "video/mp4",
        "Content-Length": String(bytes.length),
      },
      body: bytes,
    });

    const uploadJson = (await uploadRes.json().catch(() => ({}))) as { id?: string; error?: unknown };
    if (!uploadRes.ok || !uploadJson.id) {
      return NextResponse.json({ error: "YouTube video upload failed." }, { status: 502 });
    }

    const videoId = uploadJson.id;
    return NextResponse.json({
      youtubeVideoId: videoId,
      watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
      studioUrl: `https://studio.youtube.com/video/${videoId}/edit`,
      scheduledAt: scheduledAt.toISOString(),
    });
  } catch (err) {
    console.error("[youtube/schedule-upload]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to upload to YouTube" }, { status: 500 });
  }
}

