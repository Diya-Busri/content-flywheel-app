import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { adminFinanceNotesTable } from "@/db/schema/admin-finances-schema";
import { eq } from "drizzle-orm";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.trim().toLowerCase() ?? "";

async function requireAdmin() {
  const { userId, sessionClaims } = await auth();
  if (!userId) return null;
  const email = (sessionClaims?.email as string | undefined)?.trim().toLowerCase() ?? "";
  return ADMIN_EMAIL && email === ADMIN_EMAIL ? userId : null;
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  await db.delete(adminFinanceNotesTable).where(eq(adminFinanceNotesTable.id, id));
  return NextResponse.json({ ok: true });
}
