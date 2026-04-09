import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productOrdersTable } from "@/db/schema/product-orders-schema";
import { productsTable } from "@/db/schema/products-schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orders = await db
    .select({
      id: productOrdersTable.id,
      productId: productOrdersTable.productId,
      buyerEmail: productOrdersTable.buyerEmail,
      buyerName: productOrdersTable.buyerName,
      amountCents: productOrdersTable.amountCents,
      currency: productOrdersTable.currency,
      status: productOrdersTable.status,
      downloadToken: productOrdersTable.downloadToken,
      downloadExpiresAt: productOrdersTable.downloadExpiresAt,
      emailSent: productOrdersTable.emailSent,
      createdAt: productOrdersTable.createdAt,
      productTitle: productsTable.title,
    })
    .from(productOrdersTable)
    .leftJoin(productsTable, eq(productOrdersTable.productId, productsTable.id))
    .where(eq(productOrdersTable.creatorUserId, userId))
    .orderBy(desc(productOrdersTable.createdAt))
    .limit(200);

  return NextResponse.json(orders);
}
