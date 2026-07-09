import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import { announcementsTable } from "@/db/schema/announcements-schema";
import { eq } from "drizzle-orm";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const [updated] = await db.update(announcementsTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(announcementsTable.id, params.id))
    .returning();

  return NextResponse.json({ announcement: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.delete(announcementsTable).where(eq(announcementsTable.id, params.id));
  return NextResponse.json({ success: true });
}
