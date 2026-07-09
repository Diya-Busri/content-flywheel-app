import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

function pick(row: Record<string, unknown>, keys: string[], fallback: unknown = null): unknown {
  for (const k of keys) {
    if (k in row) return row[k];
  }
  return fallback;
}

function normalizeScheduledRow(row: Record<string, unknown>) {
  const id = String(pick(row, ["id"], ""));
  const contentType = String(pick(row, ["content_type", "contentType"], "video"));
  const contentJson = (pick(row, ["content_json", "contentJson"], {}) as Record<string, unknown>) ?? {};
  const platform = String(pick(row, ["platform"], "youtube"));
  const scheduledRaw = pick(row, ["scheduled_time", "scheduledTime"], null);
  const postedRaw = pick(row, ["posted_status", "postedStatus"], false);
  const createdRaw = pick(row, ["created_at", "createdAt"], null);
  return {
    id,
    contentType,
    contentJson,
    platform,
    scheduledTime: scheduledRaw ? new Date(String(scheduledRaw)).toISOString() : null,
    postedStatus: Boolean(postedRaw),
    createdAt: createdRaw ? new Date(String(createdRaw)).toISOString() : null,
  };
}

/**
 * GET: List scheduled posts for the current user (for Scheduled tab).
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const result = await db.execute(sql`
        select id, content_type, content_json, platform, scheduled_time, posted_status, created_at
        from scheduled_posts
        where user_id = ${userId}
        order by scheduled_time asc
      `);
      const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? [];
      return NextResponse.json(rows.map((r) => normalizeScheduledRow(r as Record<string, unknown>)));
    } catch {
      const result = await db.execute(sql`
        select id, "contentType", "contentJson", platform, "scheduledTime", "postedStatus", "createdAt"
        from scheduled_posts
        where "userId" = ${userId}
        order by "scheduledTime" asc
      `);
      const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? [];
      return NextResponse.json(rows.map((r) => normalizeScheduledRow(r as Record<string, unknown>)));
    }
  } catch (e) {
    console.error("[scheduled-posts] GET error:", e);
    return NextResponse.json({ error: "Failed to load scheduled posts" }, { status: 500 });
  }
}

/**
 * POST: Create a scheduled post.
 * Body: { contentType, contentJson, platform, scheduledTime (ISO string) }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "JSON body required" }, { status: 400 });
    }

    const contentType = typeof body.contentType === "string" ? body.contentType.trim() : "video";
    const contentJson = body.contentJson && typeof body.contentJson === "object" ? body.contentJson : {};
    const platformRaw = String(body.platform ?? "both").toLowerCase();
    const platform = [
      "tiktok",
      "instagram",
      "youtube",
      "facebook",
      "both",
      "multi",
    ].includes(platformRaw)
      ? platformRaw
      : "both";
    const scheduledTimeRaw = body.scheduledTime;
    if (typeof scheduledTimeRaw !== "string" || !scheduledTimeRaw) {
      return NextResponse.json({ error: "scheduledTime (ISO string) required" }, { status: 400 });
    }
    const scheduledTime = new Date(scheduledTimeRaw);
    if (Number.isNaN(scheduledTime.getTime())) {
      return NextResponse.json({ error: "Invalid scheduledTime" }, { status: 400 });
    }

    const contentJsonText = JSON.stringify(contentJson);
    const newId = randomUUID();
    try {
      const inserted = await db.execute(sql`
        insert into scheduled_posts (id, user_id, content_type, content_json, platform, scheduled_time, posted_status)
        values (${newId}, ${userId}, ${contentType}, ${contentJsonText}::jsonb, ${platform}, ${scheduledTime.toISOString()}::timestamptz, false)
        returning id, content_type, content_json, platform, scheduled_time, posted_status, created_at
      `);
      const rows = Array.isArray(inserted) ? inserted : (inserted as { rows?: unknown[] }).rows ?? [];
      const row = (rows[0] ?? null) as Record<string, unknown> | null;
      if (!row) return NextResponse.json({ error: "Insert failed" }, { status: 500 });
      return NextResponse.json(normalizeScheduledRow(row));
    } catch {
      const inserted = await db.execute(sql`
        insert into scheduled_posts (id, "userId", "contentType", "contentJson", platform, "scheduledTime", "postedStatus")
        values (${newId}, ${userId}, ${contentType}, ${contentJsonText}::jsonb, ${platform}, ${scheduledTime.toISOString()}::timestamptz, false)
        returning id, "contentType", "contentJson", platform, "scheduledTime", "postedStatus", "createdAt"
      `);
      const rows = Array.isArray(inserted) ? inserted : (inserted as { rows?: unknown[] }).rows ?? [];
      const row = (rows[0] ?? null) as Record<string, unknown> | null;
      if (!row) return NextResponse.json({ error: "Insert failed" }, { status: 500 });
      return NextResponse.json(normalizeScheduledRow(row));
    }
  } catch (e) {
    console.error("[scheduled-posts] POST error:", e);
    return NextResponse.json(
      { error: "Failed to create scheduled post" },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Delete all YouTube scheduled posts for the current user.
 * Called from Library → YouTube tab "Delete All".
 */
export async function DELETE() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      await db.execute(sql`
        delete from scheduled_posts
        where user_id = ${userId} and platform = 'youtube'
      `);
    } catch {
      await db.execute(sql`
        delete from scheduled_posts
        where "userId" = ${userId} and platform = 'youtube'
      `);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[scheduled-posts] DELETE error:", e);
    return NextResponse.json({ error: "Failed to delete posts" }, { status: 500 });
  }
}
