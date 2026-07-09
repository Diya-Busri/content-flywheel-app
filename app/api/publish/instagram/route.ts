import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { connectedAccountsTable } from "@/db/schema/connected-accounts-schema";
import { eq, and } from "drizzle-orm";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { publishInstagramCarousel } from "@/lib/instagram-carousel-publish";
import { resolveInstagramPublishContext } from "@/lib/instagram-fb-resolve";
import { INSTAGRAM_PUBLISH_SCOPE_MARKER } from "@/lib/instagram-facebook-connect-scopes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const BUCKET = "timeline-media";

function parseBase64Images(input: unknown): Buffer[] {
  if (!Array.isArray(input)) return [];
  const out: Buffer[] = [];
  for (const item of input.slice(0, 10)) {
    if (typeof item !== "string") continue;
    const raw = item.includes(",") ? item.split(",").pop() ?? item : item;
    try {
      const buf = Buffer.from(raw, "base64");
      if (buf.length > 0) out.push(buf);
    } catch {
      // skip
    }
  }
  return out;
}

async function uploadPngToPublicUrl(userId: string, buffer: Buffer, index: number): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const path = `${userId}/ig-carousel/${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}.png`;
  let result = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: "image/png",
    upsert: true,
  });
  if (result.error) {
    const msg = result.error.message?.toLowerCase() ?? "";
    if (/bucket|not found|404/.test(msg)) {
      await supabase.storage.createBucket(BUCKET, { public: true });
      result = await supabase.storage.from(BUCKET).upload(path, buffer, {
        contentType: "image/png",
        upsert: true,
      });
    }
  }
  if (result.error) {
    console.error("[publish/instagram] storage upload:", result.error.message);
    return null;
  }
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(result.data.path);
  return urlData.publicUrl;
}

/**
 * POST: Publish carousel to Instagram using Facebook Graph API.
 * Resolves Page access token + Instagram Business Account id via GET /me/accounts (not the IG Login user id alone).
 * Body: { caption: string, imagesBase64?: string[] } — PNG/JPEG base64 (data URLs ok), max 10.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const caption = typeof body.caption === "string" ? body.caption.trim() : "";
    if (!caption) {
      return NextResponse.json({ error: "caption is required" }, { status: 400 });
    }

    const buffers = parseBase64Images(body.imagesBase64);
    if (buffers.length === 0) {
      return NextResponse.json(
        { error: "imagesBase64 (non-empty array) is required" },
        { status: 400 }
      );
    }

    console.log("[publish/instagram] request:", {
      userIdPrefix: userId.slice(0, 12),
      imageCount: buffers.length,
      captionLength: caption.length,
    });

    const [account] = await db
      .select()
      .from(connectedAccountsTable)
      .where(and(eq(connectedAccountsTable.userId, userId), eq(connectedAccountsTable.platform, "instagram")));

    if (!account?.accessToken) {
      return NextResponse.json(
        { error: "Instagram is not connected. Connect it in Settings → Connected Accounts." },
        { status: 403 }
      );
    }

    const scopes = account.scopes ?? "";
    const useStoredPageToken =
      typeof scopes === "string" &&
      scopes.includes(INSTAGRAM_PUBLISH_SCOPE_MARKER) &&
      account.platformUserId?.trim() &&
      account.accessToken;

    let pageAccessToken: string;
    let igBusinessAccountId: string;

    if (useStoredPageToken) {
      pageAccessToken = account.accessToken;
      igBusinessAccountId = account.platformUserId!.trim();
      console.log("[publish/instagram] using stored Page access token + IG Business id from connect (skip /me/accounts)", {
        igBusinessAccountId,
      });
    } else {
      const resolved = await resolveInstagramPublishContext({
        accessToken: account.accessToken,
        preferredIgBusinessAccountId: account.platformUserId?.trim() ?? null,
      });
      if (!resolved.ok) {
        console.error("[publish/instagram] resolve context failed:", JSON.stringify(resolved, null, 2));
        return NextResponse.json(
          {
            success: false,
            error: resolved.error,
            hint:
              "Reconnect Instagram in Settings (Facebook login with Page + Instagram Business). Legacy Instagram-only tokens are not supported for publishing.",
            details: resolved.details,
          },
          { status: 403 }
        );
      }
      pageAccessToken = resolved.context.pageAccessToken;
      igBusinessAccountId = resolved.context.igBusinessAccountId;
      console.log("[publish/instagram] resolved publish context:", {
        igBusinessAccountId,
        pageId: resolved.context.pageId,
      });
    }

    const imageUrls: string[] = [];
    for (let i = 0; i < buffers.length; i++) {
      const url = await uploadPngToPublicUrl(userId, buffers[i], i);
      if (!url) {
        return NextResponse.json(
          {
            error:
              getSupabaseAdmin() == null
                ? "Supabase storage is not configured (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)."
                : "Failed to upload images for Instagram. Check storage bucket timeline-media.",
          },
          { status: 503 }
        );
      }
      imageUrls.push(url);
    }

    console.log("[publish/instagram] public image URLs count:", imageUrls.length);

    const result = await publishInstagramCarousel({
      igBusinessAccountId,
      pageAccessToken,
      imageUrls,
      caption,
    });

    if (result.error) {
      console.error("[publish/instagram] publishInstagramCarousel error:", result.error);
      return NextResponse.json({ success: false, error: result.error }, { status: 502 });
    }

    console.log("[publish/instagram] success mediaId:", result.mediaId);
    return NextResponse.json({ success: true, mediaId: result.mediaId });
  } catch (e) {
    console.error("[publish/instagram]", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
