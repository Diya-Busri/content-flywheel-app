import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { pageSessionsTable } from "@/db/schema/page-sessions-schema";
import { eq, sql } from "drizzle-orm";

// POST — create a new session (fire-and-forget, no auth required)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      sessionId: string;
      userId?: string | null;
      entryPage?: string;
      device?: string;
      browser?: string;
      referrer?: string | null;
      isNew?: boolean;
    };
    const { sessionId, userId, entryPage, device, browser, referrer, isNew } = body;
    if (!sessionId || typeof sessionId !== "string") return NextResponse.json({ ok: false }, { status: 400 });

    await db.insert(pageSessionsTable).values({
      sessionId,
      userId: userId ?? null,
      entryPage: entryPage ?? null,
      device: device ?? null,
      browser: browser ?? null,
      referrer: referrer ?? null,
      isNew: isNew ?? true,
      pages: entryPage ? [entryPage] : [],
    }).onConflictDoNothing();

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

// PATCH — heartbeat (update duration) and/or page navigation
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as {
      sessionId: string;
      durationSeconds?: number;
      newPage?: string;
    };
    const { sessionId, durationSeconds, newPage } = body;
    if (!sessionId || typeof sessionId !== "string") return NextResponse.json({ ok: false }, { status: 400 });

    if (newPage && typeof newPage === "string") {
      const safeNewPage = newPage.slice(0, 500);
      if (durationSeconds != null) {
        await db.execute(sql`
          UPDATE page_sessions
          SET last_ping_at = NOW(),
              page_views = page_views + 1,
              duration_seconds = ${durationSeconds},
              pages = CASE
                WHEN pages @> ${JSON.stringify([safeNewPage])}::jsonb THEN pages
                ELSE pages || ${JSON.stringify([safeNewPage])}::jsonb
              END
          WHERE session_id = ${sessionId}
        `);
      } else {
        await db.execute(sql`
          UPDATE page_sessions
          SET last_ping_at = NOW(),
              page_views = page_views + 1,
              pages = CASE
                WHEN pages @> ${JSON.stringify([safeNewPage])}::jsonb THEN pages
                ELSE pages || ${JSON.stringify([safeNewPage])}::jsonb
              END
          WHERE session_id = ${sessionId}
        `);
      }
    } else if (durationSeconds != null) {
      await db.update(pageSessionsTable)
        .set({ lastPingAt: new Date(), durationSeconds })
        .where(eq(pageSessionsTable.sessionId, sessionId));
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
