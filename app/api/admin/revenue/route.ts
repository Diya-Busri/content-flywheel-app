import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import { videoCreditTransactionsTable } from "@/db/schema/video-credit-transactions-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq, sum, count, gte, desc } from "drizzle-orm";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", { apiVersion: "2024-06-20" });

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Credit stats
  const [purchaseStats] = await db
    .select({ total: sum(videoCreditTransactionsTable.amount), txCount: count() })
    .from(videoCreditTransactionsTable)
    .where(eq(videoCreditTransactionsTable.type, "purchase"));

  const [usageStats] = await db
    .select({ total: sum(videoCreditTransactionsTable.amount), txCount: count() })
    .from(videoCreditTransactionsTable)
    .where(eq(videoCreditTransactionsTable.type, "usage"));

  // Recent transactions
  const recentTx = await db
    .select()
    .from(videoCreditTransactionsTable)
    .orderBy(desc(videoCreditTransactionsTable.createdAt))
    .limit(50);

  // Usage by video type
  const usageByType = await db
    .select({
      description: videoCreditTransactionsTable.description,
      total: sum(videoCreditTransactionsTable.amount),
      txCount: count(),
    })
    .from(videoCreditTransactionsTable)
    .where(eq(videoCreditTransactionsTable.type, "usage"))
    .groupBy(videoCreditTransactionsTable.description);

  // User counts
  const [totalUsers] = await db.select({ count: count() }).from(profilesTable);
  const [proUsers] = await db
    .select({ count: count() })
    .from(profilesTable)
    .where(eq(profilesTable.membership, "pro"));

  // Stripe recent charges
  let stripeCharges: { id: string; amount: number; currency: string; created: number; email: string | null; status: string }[] = [];
  try {
    const charges = await stripe.charges.list({ limit: 20 });
    stripeCharges = charges.data.map((c) => ({
      id: c.id,
      amount: c.amount,
      currency: c.currency,
      created: c.created,
      email: c.billing_details?.email ?? null,
      status: c.status,
    }));
  } catch {
    // Stripe key not set or error — skip
  }

  return NextResponse.json({
    creditsPurchased: Number(purchaseStats?.total ?? 0),
    purchaseCount: Number(purchaseStats?.txCount ?? 0),
    creditsUsed: Number(usageStats?.total ?? 0),
    usageCount: Number(usageStats?.txCount ?? 0),
    totalUsers: Number(totalUsers?.count ?? 0),
    proUsers: Number(proUsers?.count ?? 0),
    recentTransactions: recentTx,
    usageByType,
    stripeCharges,
  });
}
