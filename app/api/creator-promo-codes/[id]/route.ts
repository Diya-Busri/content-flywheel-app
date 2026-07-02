export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { creatorPromoCodesTable } from "@/db/schema/creator-promo-codes-schema";
import { and, eq } from "drizzle-orm";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  await db
    .update(creatorPromoCodesTable)
    .set({ active: false })
    .where(and(eq(creatorPromoCodesTable.id, id), eq(creatorPromoCodesTable.creatorUserId, userId)));

  return NextResponse.json({ ok: true });
}
