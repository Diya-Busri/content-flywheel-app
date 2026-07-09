import { db } from "@/db/db";
import { userEventsTable } from "@/db/schema/user-events-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq } from "drizzle-orm";

/**
 * Log a user behaviour event. Fire-and-forget — never throws.
 * Also updates lastActiveAt on the profile.
 */
export async function logEvent(
  userId: string,
  event: string,
  metadata?: Record<string, unknown>
) {
  try {
    await Promise.all([
      db.insert(userEventsTable).values({ userId, event, metadata: metadata ?? null }),
      db
        .update(profilesTable)
        .set({ lastActiveAt: new Date() })
        .where(eq(profilesTable.userId, userId)),
    ]);
  } catch {
    // Never throw from a logging helper
  }
}
