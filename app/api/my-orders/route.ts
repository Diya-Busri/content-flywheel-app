import { NextResponse } from "next/server";
import { db } from "@/db/db";
import { productOrdersTable } from "@/db/schema/product-orders-schema";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, desc } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const rows = await db
      .select({
        id: productOrdersTable.id,
        productId: productOrdersTable.productId,
        amountCents: productOrdersTable.amountCents,
        currency: productOrdersTable.currency,
        createdAt: productOrdersTable.createdAt,
        downloadToken: productOrdersTable.downloadToken,
        downloadExpiresAt: productOrdersTable.downloadExpiresAt,
        productTitle: productsTable.title,
        productMarketingAssets: productsTable.marketingAssets,
      })
      .from(productOrdersTable)
      .leftJoin(productsTable, eq(productOrdersTable.productId, productsTable.id))
      .where(
        and(
          eq(productOrdersTable.buyerEmail, normalizedEmail),
          eq(productOrdersTable.status, "completed")
        )
      )
      .orderBy(desc(productOrdersTable.createdAt));

    const orders = rows.map((row) => {
      const ma = (row.productMarketingAssets ?? {}) as { isCourseFormat?: boolean };
      return {
        id: row.id,
        productId: row.productId,
        productTitle: row.productTitle ?? "Digital Product",
        amountCents: row.amountCents,
        currency: row.currency,
        createdAt: row.createdAt.toISOString(),
        downloadToken: row.downloadToken ?? null,
        downloadExpiresAt: row.downloadExpiresAt ? row.downloadExpiresAt.toISOString() : null,
        isCourseFormat: !!ma.isCourseFormat,
      };
    });

    return NextResponse.json(orders);
  } catch (err) {
    console.error("[my-orders] POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
