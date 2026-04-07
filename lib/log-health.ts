import { db } from "@/db/db";
import { adminHealthLogsTable } from "@/db/schema/admin-health-logs-schema";

export async function logHealth(
  level: "error" | "warning" | "info",
  route: string,
  message: string,
  opts?: { userId?: string; metadata?: Record<string, unknown> }
) {
  try {
    await db.insert(adminHealthLogsTable).values({
      level,
      route,
      message,
      userId: opts?.userId ?? null,
      metadata: opts?.metadata ?? null,
    });
  } catch {
    // Never throw from a logging helper
  }
}
