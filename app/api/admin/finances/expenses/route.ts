import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { adminExpensesTable } from "@/db/schema/admin-finances-schema";
import { desc, eq } from "drizzle-orm";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.trim().toLowerCase() ?? "";

async function requireAdmin() {
  const { userId, sessionClaims } = await auth();
  if (!userId) return null;
  const email = (sessionClaims?.email as string | undefined)?.trim().toLowerCase() ?? "";
  return ADMIN_EMAIL && email === ADMIN_EMAIL ? userId : null;
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const expenses = await db.select().from(adminExpensesTable).orderBy(desc(adminExpensesTable.date));
  return NextResponse.json(expenses);
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { amountPence, category, description, date } = await req.json();
  if (!amountPence || !description || !date) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  const [created] = await db.insert(adminExpensesTable).values({
    amountPence: Math.round(amountPence),
    category: category ?? "other",
    description,
    date,
  }).returning();
  return NextResponse.json(created, { status: 201 });
}
