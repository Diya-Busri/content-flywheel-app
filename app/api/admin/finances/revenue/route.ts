import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/db/db";
import { productOrdersTable } from "@/db/schema/product-orders-schema";
import { eq, sum } from "drizzle-orm";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.trim().toLowerCase() ?? "";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const email = user.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase() ?? "";
  if (!ADMIN_EMAIL || email !== ADMIN_EMAIL) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [result] = await db
    .select({ total: sum(productOrdersTable.amountCents) })
    .from(productOrdersTable)
    .where(eq(productOrdersTable.status, "completed"));

  return NextResponse.json({ total: Number(result?.total ?? 0) });
}
