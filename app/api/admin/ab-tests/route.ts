import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import { abTestsTable, abTestAssignmentsTable } from "@/db/schema/ab-tests-schema";
import { eq, desc, count } from "drizzle-orm";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const tests = await db.select().from(abTestsTable).orderBy(desc(abTestsTable.createdAt));
  return NextResponse.json({ tests });
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { key, name, description, variants = [] } = body;
  if (!key || !name) return NextResponse.json({ error: "key and name required" }, { status: 400 });

  const [test] = await db.insert(abTestsTable).values({ key, name, description, variants, active: false }).returning();
  return NextResponse.json({ test });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const [updated] = await db.update(abTestsTable).set({ ...updates, updatedAt: new Date() }).where(eq(abTestsTable.id, id)).returning();
  return NextResponse.json({ test: updated });
}
