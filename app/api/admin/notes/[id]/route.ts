import { currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { adminNotesTable } from "@/db/schema/admin-finances-schema";
import { eq } from "drizzle-orm";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";

async function requireAdmin() {
  const user = await currentUser();
  if (!user) return null;
  const email = user.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase() ?? "";
  return ADMIN_EMAIL && email === ADMIN_EMAIL ? user.id : null;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const update: Record<string, string> = { updatedAt: new Date().toISOString() };
  if (typeof body.content === "string") update.content = body.content.trim();
  if (typeof body.tag === "string") update.tag = body.tag;
  if (typeof body.pinned === "string") update.pinned = body.pinned;
  const [updated] = await db
    .update(adminNotesTable)
    .set(update)
    .where(eq(adminNotesTable.id, params.id))
    .returning();
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await db.delete(adminNotesTable).where(eq(adminNotesTable.id, params.id));
  return NextResponse.json({ ok: true });
}
