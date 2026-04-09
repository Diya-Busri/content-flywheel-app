import { currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { adminExpensesTable } from "@/db/schema/admin-finances-schema";
import { desc, eq } from "drizzle-orm";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.trim().toLowerCase() ?? "";

async function requireAdmin() {
  const user = await currentUser();
  if (!user) return null;
  const email = user.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase() ?? "";
  return ADMIN_EMAIL && email === ADMIN_EMAIL ? user.id : null;
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const expenses = await db.select().from(adminExpensesTable).orderBy(desc(adminExpensesTable.date));
    return NextResponse.json(expenses);
  } catch (err) {
    console.error("[admin/finances/expenses] GET error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    // Table likely doesn't exist yet — return empty array so page doesn't break
    if (msg.includes("does not exist") || msg.includes("relation")) {
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const { amountPence, category, description, date } = await req.json();
    if (!amountPence || !description || !date) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    const [created] = await db.insert(adminExpensesTable).values({
      amountPence: Math.round(amountPence),
      category: category ?? "other",
      description,
      date,
    }).returning();
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("[admin/finances/expenses] POST error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("does not exist") || msg.includes("relation")) {
      return NextResponse.json(
        { error: "Database table not set up yet. Run the admin-finances-migration.sql in Supabase SQL Editor." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await db.delete(adminExpensesTable).where(eq(adminExpensesTable.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/finances/expenses] DELETE error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
