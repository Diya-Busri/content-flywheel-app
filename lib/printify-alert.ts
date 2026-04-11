import { db } from "@/db/db";
import { adminHealthLogsTable } from "@/db/schema/admin-health-logs-schema";
import { notificationsTable } from "@/db/schema/notifications-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq } from "drizzle-orm";

/**
 * Log a Printify error to admin_health_logs and send an in-app notification to the admin account.
 * Call this from any Printify API route catch block.
 */
export async function alertPrintifyError({
  route,
  message,
  userId,
  metadata,
}: {
  route: string;
  message: string;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    // 1. Write to health logs
    await db.insert(adminHealthLogsTable).values({
      level: "error",
      route,
      message,
      userId: userId ?? null,
      metadata: metadata ?? null,
    });

    // 2. Find admin user by ADMIN_EMAIL
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (!adminEmail) return;

    const [adminProfile] = await db
      .select({ userId: profilesTable.userId })
      .from(profilesTable)
      .where(eq(profilesTable.email, adminEmail))
      .limit(1);

    if (!adminProfile) return;

    // 3. Send in-app notification to admin
    await db.insert(notificationsTable).values({
      userId: adminProfile.userId,
      title: "Printify issue reported",
      message: userId
        ? `User ${userId} hit an error on ${route}: ${message}`
        : `Error on ${route}: ${message}`,
      type: "error",
      linkUrl: "/dashboard/settings",
    });
  } catch {
    // Never let alerting break the main request
  }
}
