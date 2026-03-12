import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { connectedAccountsTable } from "@/db/schema/connected-accounts-schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

function getRedirectUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/dashboard/settings/connected-accounts`;
}

/**
 * GET: YouTube OAuth callback. Exchanges code for tokens and stores in connected_accounts.
 * Query: code, state. Redirects to connected-accounts page on success/error.
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
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const errorParam = searchParams.get("error");

    if (errorParam) {
      return errorRedirect(
        errorParam === "access_denied" ? "Access denied." : errorParam
      );
    }
    if (!code) return errorRedirect("Missing authorization code.");

    if (state) {
      const parts = state.split(":");
      if (parts[0] === "youtube" && parts[1] && parts[1] !== userId) {
        return errorRedirect("State mismatch.");
      }
    }

    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      "http://localhost:3000";

    if (!clientId || !clientSecret || !baseUrl) {
      return errorRedirect("YouTube OAuth not configured.");
    }

    const callbackUrl = `${baseUrl.replace(/\/$/, "")}/api/auth/youtube/callback`;

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

    const data = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error_description?: string;
    };

    if (!res.ok || !data.access_token) {
      return errorRedirect(
        data.error_description || "YouTube token exchange failed."
      );
    }

    const accessToken = data.access_token;
    const refreshToken = data.refresh_token ?? null;
    let expiresAt: Date | null = null;
    if (data.expires_in) {
      const d = new Date();
      d.setSeconds(d.getSeconds() + data.expires_in);
      expiresAt = d;
    }

    const existing = await db
      .select()
      .from(connectedAccountsTable)
      .where(
        and(
          eq(connectedAccountsTable.userId, userId),
          eq(connectedAccountsTable.platform, "youtube")
        )
      )
      .limit(1);

    const scopes = "https://www.googleapis.com/auth/youtube.upload";

    if (existing.length > 0) {
      await db
        .update(connectedAccountsTable)
        .set({
          accessToken,
          refreshToken,
          expiresAt,
          scopes,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(connectedAccountsTable.userId, userId),
            eq(connectedAccountsTable.platform, "youtube")
          )
        );
    } else {
      await db.insert(connectedAccountsTable).values({
        userId,
        platform: "youtube",
        accessToken,
        refreshToken,
        expiresAt,
        scopes,
      });
    }

    return successRedirect();
  } catch (err) {
    console.error("[auth/youtube/callback]", err);
    return errorRedirect(
      err instanceof Error ? err.message : "Connection failed."
    );
  }
}
