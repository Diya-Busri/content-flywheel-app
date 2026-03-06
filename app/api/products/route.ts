import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, desc, and, isNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** GET: List current user's products (id, title, format) for e.g. AI Coach product context dropdown. */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const products = await db
      .select({
        id: productsTable.id,
        title: productsTable.title,
        format: productsTable.format,
      })
      .from(productsTable)
      .where(and(eq(productsTable.userId, userId), isNull(productsTable.deletedAt)))
      .orderBy(desc(productsTable.createdAt));
    return NextResponse.json({ products });
  } catch (err) {
    console.error("[GET /api/products]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list products" },
      { status: 500 }
    );
  }
}
