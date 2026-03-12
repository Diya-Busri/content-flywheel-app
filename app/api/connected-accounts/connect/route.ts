import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import type { ConnectedPlatform } from "@/db/schema/connected-accounts-schema";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

const PLATFORMS: ConnectedPlatform[] = ["tiktok", "youtube", "instagram", "facebook"];

function buildAuthUrl(platform: ConnectedPlatform, state: string): string | null {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000";
  const callbackUrl = `${baseUrl.replace(/\/$/, "")}/api/connected-accounts/callback?platform=${platform}`;

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
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: callbackUrl,
        response_type: "code",
        scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
        access_type: "offline",
        prompt: "consent",
        state,
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }
    case "instagram":
    case "facebook": {
      const appId = process.env.FACEBOOK_APP_ID;
      if (!appId) return null;
      const scope = platform === "instagram"
        ? "instagram_business_basic"
        : "public_profile";
      const params = new URLSearchParams({
        client_id: appId,
        redirect_uri: callbackUrl,
        response_type: "code",
        scope,
        state,
      });
      return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
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
    const authUrl = buildAuthUrl(platform, state);
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
