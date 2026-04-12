import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { bioPagesTable, waitlistEntriesTable } from "@/db/schema/bio-page-schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** POST /api/bio-page/waitlist — public signup. Body: { slug, email, name? } */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as {
      slug?: string;
      email?: string;
      name?: string;
    };

    if (!body.slug) return NextResponse.json({ error: "slug required" }, { status: 400 });
    if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    const [page] = await db.select({ userId: bioPagesTable.userId }).from(bioPagesTable).where(eq(bioPagesTable.slug, body.slug));
    if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });

    await db.insert(waitlistEntriesTable).values({
      userId: page.userId,
      email: body.email.trim().toLowerCase(),
      name: body.name?.trim() || null,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[bio-page/waitlist] POST error:", e);
    return NextResponse.json({ error: "Failed to join waitlist" }, { status: 500 });
  }
}

/** GET /api/bio-page/waitlist — get entries for authenticated user */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const entries = await db
      .select()
      .from(waitlistEntriesTable)
      .where(eq(waitlistEntriesTable.userId, userId))
      .orderBy(desc(waitlistEntriesTable.createdAt));

    return NextResponse.json({ entries, count: entries.length });
  } catch (e) {
    console.error("[bio-page/waitlist] GET error:", e);
    return NextResponse.json({ error: "Failed to load entries" }, { status: 500 });
  }
}
