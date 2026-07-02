export const dynamic = "force-dynamic";
import { currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { adminFinanceNotesTable } from "@/db/schema/admin-finances-schema";
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
  await db.delete(adminFinanceNotesTable).where(eq(adminFinanceNotesTable.id, id));
  return NextResponse.json({ ok: true });
}
