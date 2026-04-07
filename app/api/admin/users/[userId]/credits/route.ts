import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import { profilesTable } from "@/db/schema/profiles-schema";
import { videoCreditTransactionsTable } from "@/db/schema/video-credit-transactions-schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest, { params }: { params: { userId: string } }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = params;
  const body = (await req.json().catch(() => ({}))) as { amount?: number; note?: string };
  const amount = Math.round(Number(body.amount ?? 0));

  if (!amount || isNaN(amount)) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const profile = await db.query.profilesTable.findFirst({ where: eq(profilesTable.userId, userId) });
  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const newBalance = Math.max(0, (profile.videoCredits ?? 0) + amount);
  await db.update(profilesTable).set({ videoCredits: newBalance }).where(eq(profilesTable.userId, userId));

  await db.insert(videoCreditTransactionsTable).values({
    userId,
    type: amount > 0 ? "purchase" : "usage",
    amount: Math.abs(amount),
    description: body.note ?? (amount > 0 ? "Admin grant" : "Admin deduction"),
  });

  return NextResponse.json({ ok: true, newBalance });
}
