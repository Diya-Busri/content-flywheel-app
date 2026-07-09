import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { emailContactsTable } from "@/db/schema/email-marketing-schema";
import { eq, and, isNull, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Total active subscribers
  const [totals] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(emailContactsTable)
    .where(and(eq(emailContactsTable.userId, userId), isNull(emailContactsTable.unsubscribedAt)));

  // Subscribers per week for last 12 weeks
  const weekly = await db
    .select({
      week: sql<string>`TO_CHAR(DATE_TRUNC('week', ${emailContactsTable.subscribedAt}), 'Mon DD')`,
      count: sql<number>`COUNT(*)`,
    })
    .from(emailContactsTable)
    .where(
      and(
        eq(emailContactsTable.userId, userId),
        isNull(emailContactsTable.unsubscribedAt),
        sql`${emailContactsTable.subscribedAt} >= NOW() - INTERVAL '12 weeks'`
      )
    )
    .groupBy(sql`DATE_TRUNC('week', ${emailContactsTable.subscribedAt})`)
    .orderBy(sql`DATE_TRUNC('week', ${emailContactsTable.subscribedAt})`);

  return NextResponse.json({
    total: Number(totals?.count ?? 0),
    weekly: weekly.map((w) => ({ week: w.week, count: Number(w.count) })),
  });
}
