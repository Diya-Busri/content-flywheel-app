import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { videoCreditTransactionsTable } from "@/db/schema/video-credit-transactions-schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const transactions = await db
    .select()
    .from(videoCreditTransactionsTable)
    .where(eq(videoCreditTransactionsTable.userId, userId))
    .orderBy(desc(videoCreditTransactionsTable.createdAt))
    .limit(50);

  const totalPurchased = transactions
    .filter((t) => t.type === "purchase")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalUsed = transactions
    .filter((t) => t.type === "usage")
    .reduce((sum, t) => sum + t.amount, 0);

  return NextResponse.json({ transactions, totalPurchased, totalUsed });
}
