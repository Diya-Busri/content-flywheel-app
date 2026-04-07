import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import { profilesTable } from "@/db/schema/profiles-schema";
import { videoCreditTransactionsTable } from "@/db/schema/video-credit-transactions-schema";
import { eq, count, sum, desc } from "drizzle-orm";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const profiles = await db
    .select()
    .from(profilesTable)
    .orderBy(desc(profilesTable.createdAt));

  const txStats = await db
    .select({
      userId: videoCreditTransactionsTable.userId,
      type: videoCreditTransactionsTable.type,
      total: sum(videoCreditTransactionsTable.amount),
      txCount: count(),
    })
    .from(videoCreditTransactionsTable)
    .groupBy(videoCreditTransactionsTable.userId, videoCreditTransactionsTable.type);

  const statsByUser: Record<string, { purchased: number; used: number; videoCount: number }> = {};
  for (const row of txStats) {
    if (!statsByUser[row.userId]) statsByUser[row.userId] = { purchased: 0, used: 0, videoCount: 0 };
    const amt = Number(row.total ?? 0);
    if (row.type === "purchase") statsByUser[row.userId].purchased += amt;
    if (row.type === "usage") {
      statsByUser[row.userId].used += amt;
      statsByUser[row.userId].videoCount += Number(row.txCount ?? 0);
    }
  }

  const users = profiles.map((p) => ({
    userId: p.userId,
    email: p.email ?? "—",
    membership: p.membership,
    videoCredits: p.videoCredits,
    status: p.status ?? "active",
    createdAt: p.createdAt,
    stats: statsByUser[p.userId] ?? { purchased: 0, used: 0, videoCount: 0 },
  }));

  return NextResponse.json({ users });
}
