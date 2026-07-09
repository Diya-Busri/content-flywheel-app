export const dynamic = "force-dynamic";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { podProductsTable } from "@/db/schema/pod-products-schema";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const products = await db
    .select({
      id: podProductsTable.id,
      title: podProductsTable.title,
      blueprintTitle: podProductsTable.blueprintTitle,
      mockupUrls: podProductsTable.mockupUrls,
      designFileUrl: podProductsTable.designFileUrl,
    })
    .from(podProductsTable)
    .where(eq(podProductsTable.userId, userId))
    .orderBy(desc(podProductsTable.createdAt));

  return NextResponse.json(products);
}
