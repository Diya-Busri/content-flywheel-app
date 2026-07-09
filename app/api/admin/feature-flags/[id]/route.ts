import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import { featureFlagsTable } from "@/db/schema/feature-flags-schema";
import { eq } from "drizzle-orm";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { enabled?: boolean; label?: string; description?: string };
  const [flag] = await db
    .update(featureFlagsTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(featureFlagsTable.id, params.id))
    .returning();
  return NextResponse.json({ flag });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await db.delete(featureFlagsTable).where(eq(featureFlagsTable.id, params.id));
  return NextResponse.json({ ok: true });
}
