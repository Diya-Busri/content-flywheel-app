export const dynamic = "force-dynamic";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { podProductsTable } from "@/db/schema/pod-products-schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { productId } = await req.json() as { productId?: string };
  if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

  await db
    .delete(podProductsTable)
    .where(and(eq(podProductsTable.id, productId), eq(podProductsTable.userId, userId)));

  return NextResponse.json({ success: true });
}
