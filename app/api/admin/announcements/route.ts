import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import { announcementsTable } from "@/db/schema/announcements-schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const announcements = await db.select().from(announcementsTable).orderBy(desc(announcementsTable.createdAt));
  return NextResponse.json({ announcements });
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { title, message, type = "info", linkUrl, linkLabel, expiresAt } = body;
  if (!title || !message) return NextResponse.json({ error: "title and message required" }, { status: 400 });

  const [announcement] = await db.insert(announcementsTable).values({
    title, message, type,
    linkUrl: linkUrl || null,
    linkLabel: linkLabel || null,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    active: true,
    targetAll: true,
  }).returning();

  return NextResponse.json({ announcement });
}
