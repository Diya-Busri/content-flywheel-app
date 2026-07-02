export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { referralsTable } from "@/db/schema/referrals-schema";
import { eq, count } from "drizzle-orm";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [row] = await db
      .select({ total: count() })
      .from(referralsTable)
      .where(eq(referralsTable.referrerUserId, userId));

    return NextResponse.json({ total: row?.total ?? 0 });
  } catch (e) {
    console.error("[referral/stats]", e);
    return NextResponse.json({ total: 0 });
  }
}
