import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import { promoCodesTable } from "@/db/schema/promo-codes-schema";
import { eq } from "drizzle-orm";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = auth();
  if (!userId || !(await isAdmin(userId))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const [updated] = await db.update(promoCodesTable).set(body).where(eq(promoCodesTable.id, params.id)).returning();
  return NextResponse.json({ code: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = auth();
  if (!userId || !(await isAdmin(userId))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.delete(promoCodesTable).where(eq(promoCodesTable.id, params.id));
  return NextResponse.json({ success: true });
}
