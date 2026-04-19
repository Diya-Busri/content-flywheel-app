import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { videoCreditTransactionsTable } from "@/db/schema/video-credit-transactions-schema";
import { eq, desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Aggregate totals across ALL transactions (no limit) via SQL
  const [aggregates] = await db
    .select({
      totalPurchased: sql<number>`coalesce(sum(case when type = 'purchase' then amount else 0 end), 0)`,
      totalUsed: sql<number>`coalesce(sum(case when type = 'usage' then amount else 0 end), 0)`,
    })
    .from(videoCreditTransactionsTable)
    .where(eq(videoCreditTransactionsTable.userId, userId));

  // Recent transactions for display only (capped to 50)
  const transactions = await db
    .select()
    .from(videoCreditTransactionsTable)
    .where(eq(videoCreditTransactionsTable.userId, userId))
    .orderBy(desc(videoCreditTransactionsTable.createdAt))
    .limit(50);

  return NextResponse.json({
    transactions,
    totalPurchased: Number(aggregates?.totalPurchased ?? 0),
    totalUsed: Number(aggregates?.totalUsed ?? 0),
  });
}
