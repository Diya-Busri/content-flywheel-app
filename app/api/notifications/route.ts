import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { notificationsTable } from "@/db/schema/notifications-schema";
import { eq, desc, and } from "drizzle-orm";

export async function GET() {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const notifications = await db.select().from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);

  return NextResponse.json({ notifications });
}

export async function PATCH(req: NextRequest) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, readAll } = body;

  if (readAll) {
    await db.update(notificationsTable)
      .set({ read: true })
      .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.read, false)));
  } else if (id) {
    await db.update(notificationsTable)
      .set({ read: true })
      .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, userId)));
  }

  return NextResponse.json({ success: true });
}
