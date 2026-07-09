import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { productHistoryTable } from "@/db/schema/product-history-schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET: List all product history for the current user.
 * Uses Clerk auth userId; table is product_history with user_id column.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await db
      .select({
        id: productHistoryTable.id,
        productId: productHistoryTable.productId,
        productTitle: productHistoryTable.productTitle,
        formatType: productHistoryTable.formatType,
        status: productHistoryTable.status,
        createdAt: productHistoryTable.createdAt,
      })
      .from(productHistoryTable)
      .where(eq(productHistoryTable.userId, userId))
      .orderBy(desc(productHistoryTable.createdAt));

    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        productId: r.productId ?? undefined,
        productTitle: r.productTitle,
        formatType: r.formatType,
        status: r.status,
        createdAt: r.createdAt?.toISOString(),
      }))
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[product-history] GET error:", message, e);
    return NextResponse.json(
      { error: "Failed to load history" },
      { status: 500 }
    );
  }
}
