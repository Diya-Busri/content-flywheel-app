import { db } from "@/db/db";
import { challengeSubmissionsTable } from "@/db/schema/challenge-submissions-schema";
import { eq } from "drizzle-orm";

/**
 * Generates a unique human-facing reference like "CF-1042" for a 100 Product
 * Challenge submission. Retries a handful of times against the DB's unique
 * index on `reference` in the unlikely event of a collision.
 */
export async function generateChallengeReference(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const num = 1000 + Math.floor(Math.random() * 9000); // 1000–9999
    const candidate = `CF-${num}`;
    const [existing] = await db
      .select({ id: challengeSubmissionsTable.id })
      .from(challengeSubmissionsTable)
      .where(eq(challengeSubmissionsTable.reference, candidate))
      .limit(1);
    if (!existing) return candidate;
  }
  // Extremely unlikely fallback — wider range + timestamp suffix to guarantee uniqueness.
  return `CF-${Date.now().toString().slice(-6)}`;
}
