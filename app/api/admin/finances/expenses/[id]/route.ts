import { currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { adminExpensesTable } from "@/db/schema/admin-finances-schema";
import { eq } from "drizzle-orm";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";

async function requireAdmin() {
  const user = await currentUser();
  if (!user) return null;
  const email = user.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase() ?? "";
  return ADMIN_EMAIL && email === ADMIN_EMAIL ? user.id : null;
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  await db.delete(adminExpensesTable).where(eq(adminExpensesTable.id, id));
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const { description } = body;
  if (!description?.trim()) return NextResponse.json({ error: "Description required" }, { status: 400 });
  await db.update(adminExpensesTable).set({ description: description.trim() }).where(eq(adminExpensesTable.id, id));
  return NextResponse.json({ ok: true });
}
