import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productReviewsTable } from "@/db/schema/product-reviews-schema";
import { and, eq } from "drizzle-orm";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  await db
    .update(productReviewsTable)
    .set({ approved: true })
    .where(and(eq(productReviewsTable.id, id), eq(productReviewsTable.creatorUserId, userId)));

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  await db
    .delete(productReviewsTable)
    .where(and(eq(productReviewsTable.id, id), eq(productReviewsTable.creatorUserId, userId)));

  return NextResponse.json({ ok: true });
}
