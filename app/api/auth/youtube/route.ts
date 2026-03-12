import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

const YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube.upload";

/**
 * GET: Initiates YouTube OAuth flow. Redirects to Google consent screen.
 * Requires user to be signed in (Clerk). On success, user is redirected to
 * /api/auth/youtube/callback with the auth code.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      "http://localhost:3000";

    if (!clientId || !baseUrl) {
      return NextResponse.json(
        { error: "YouTube OAuth not configured. Set GOOGLE_CLIENT_ID and NEXT_PUBLIC_APP_URL." },
        { status: 503 }
      );
    }

    const callbackUrl = `${baseUrl.replace(/\/$/, "")}/api/auth/youtube/callback`;
    const state = `youtube:${userId}:${randomBytes(16).toString("hex")}`;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: "code",
      scope: YOUTUBE_SCOPE,
      access_type: "offline",
      prompt: "consent",
      state,
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return NextResponse.redirect(authUrl);
  } catch (err) {
    console.error("[auth/youtube]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "OAuth initiation failed" },
      { status: 500 }
    );
  }
}
