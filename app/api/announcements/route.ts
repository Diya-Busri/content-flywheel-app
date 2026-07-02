export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { announcementsTable } from "@/db/schema/announcements-schema";
import { and, eq, or, isNull, gt } from "drizzle-orm";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ announcements: [] });

  const now = new Date();
  const announcements = await db.select().from(announcementsTable)
    .where(
      and(
        eq(announcementsTable.active, true),
        or(isNull(announcementsTable.expiresAt), gt(announcementsTable.expiresAt, now))
      )
    )
    .limit(3);

  return NextResponse.json({ announcements });
}
