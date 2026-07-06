export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { pushSubscriptionsTable } from "@/db/schema/push-subscriptions-schema";
import { eq, and } from "drizzle-orm";

// Register a push subscription
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { endpoint, p256dh, auth: authKey } = body;
  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const userAgent = req.headers.get("user-agent") ?? undefined;

  // Upsert — if endpoint exists update userId, otherwise insert
  await db
    .insert(pushSubscriptionsTable)
    .values({ userId, endpoint, p256dh, auth: authKey, userAgent })
    .onConflictDoUpdate({
      target: pushSubscriptionsTable.endpoint,
      set: { userId, p256dh, auth: authKey, userAgent },
    });

  return NextResponse.json({ success: true });
}

// Unregister (DELETE)
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { endpoint } = body;

  if (endpoint) {
    await db
      .delete(pushSubscriptionsTable)
      .where(and(eq(pushSubscriptionsTable.userId, userId), eq(pushSubscriptionsTable.endpoint, endpoint)));
  }

  return NextResponse.json({ success: true });
}
