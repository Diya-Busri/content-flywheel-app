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

/**
 * Server-side: get (or assign) a variant for a user.
 * Use this in Server Components and API routes.
 *
 * Example:
 *   const variant = await getVariant("onboarding_v2", userId);
 *   if (variant === "new_flow") { ... }
 */
export async function getVariant(testKey: string, userId: string): Promise<string> {
  try {
    // Return existing assignment
    const [existing] = await db.select().from(abTestAssignmentsTable)
      .where(and(eq(abTestAssignmentsTable.testKey, testKey), eq(abTestAssignmentsTable.userId, userId)));
    if (existing) return existing.variant;

    // Get active test
    const [test] = await db.select().from(abTestsTable)
      .where(and(eq(abTestsTable.key, testKey), eq(abTestsTable.active, true)));
    if (!test) return "control";

    const variants = (test.variants as Variant[]) ?? [];
    if (variants.length === 0) return "control";

    const variant = pickVariant(variants);
    await db.insert(abTestAssignmentsTable).values({ testKey, userId, variant }).onConflictDoNothing();
    return variant;
  } catch {
    return "control";
  }
}
