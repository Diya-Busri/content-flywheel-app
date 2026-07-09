import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { videoCreditTransactionsTable } from "@/db/schema/video-credit-transactions-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq, desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch both profile (source of truth for remaining balance) and transaction aggregates
  // in parallel to keep the response fast.
  const [profileRows, aggregates, transactions] = await Promise.all([
    db
      .select({ videoCredits: profilesTable.videoCredits })
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .limit(1),

    // Aggregate totals across ALL transactions (no limit) via SQL
    db
      .select({
        totalPurchased: sql<number>`coalesce(sum(case when type = 'purchase' then amount else 0 end), 0)`,
        totalUsed: sql<number>`coalesce(sum(case when type = 'usage' then amount else 0 end), 0)`,
      })
      .from(videoCreditTransactionsTable)
      .where(eq(videoCreditTransactionsTable.userId, userId)),

    // Recent transactions for the activity feed (capped to 50)
    db
      .select()
      .from(videoCreditTransactionsTable)
      .where(eq(videoCreditTransactionsTable.userId, userId))
      .orderBy(desc(videoCreditTransactionsTable.createdAt))
      .limit(50),
  ]);

  const actualBalance = profileRows[0]?.videoCredits ?? 0;
  const totalPurchased = Number(aggregates[0]?.totalPurchased ?? 0);
  const totalUsedFromTx = Number(aggregates[0]?.totalUsed ?? 0);

  // Derive a reconciled "totalUsed" figure.
  // If the transaction log is complete: totalPurchased - totalUsed = actualBalance.
  // If there's a discrepancy (e.g., from legacy deductions before the atomic fix,
  // or a transaction logging failure), we trust the actual balance as the source of
  // truth and compute totalUsed = totalPurchased - actualBalance.
  //
  // We show whichever is LARGER to avoid displaying "used" going backward if
  // someone received an admin grant that wasn't logged as a purchase.
  const derivedUsed = Math.max(0, totalPurchased - actualBalance);
  const totalUsed = Math.max(totalUsedFromTx, derivedUsed);

  return NextResponse.json({
    transactions,
    totalPurchased,
    totalUsed,
    // Include actualBalance so the client can cross-check what it got from /balance
    actualBalance,
  });
}
