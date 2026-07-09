export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { abTestsTable, abTestAssignmentsTable } from "@/db/schema/ab-tests-schema";
import { eq, and } from "drizzle-orm";

interface Variant {
  key: string;
  label: string;
  weight: number;
}

function pickVariant(variants: Variant[]): string {
  const total = variants.reduce((sum, v) => sum + (v.weight || 0), 0);
  if (total === 0) return variants[0]?.key ?? "control";
  let rand = Math.random() * total;
  for (const v of variants) {
    rand -= v.weight;
    if (rand <= 0) return v.key;
  }
  return variants[variants.length - 1].key;
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const testKey = searchParams.get("test");
  if (!testKey) return NextResponse.json({ error: "test param required" }, { status: 400 });

  // Check for existing assignment
  const [existing] = await db.select().from(abTestAssignmentsTable)
    .where(and(eq(abTestAssignmentsTable.testKey, testKey), eq(abTestAssignmentsTable.userId, userId)));
  if (existing) return NextResponse.json({ variant: existing.variant, testKey });

  // Get test config
  const [test] = await db.select().from(abTestsTable)
    .where(and(eq(abTestsTable.key, testKey), eq(abTestsTable.active, true)));

  if (!test) return NextResponse.json({ variant: "control", testKey }); // default if test not found

  const variants = (test.variants as Variant[]) ?? [];
  if (variants.length === 0) return NextResponse.json({ variant: "control", testKey });

  const variant = pickVariant(variants);

  // Store assignment
  await db.insert(abTestAssignmentsTable).values({ testKey, userId, variant }).onConflictDoNothing();

  return NextResponse.json({ variant, testKey });
}
