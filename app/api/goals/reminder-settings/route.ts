export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { goalReminderSettingsTable } from "@/db/schema/goals-schema";
import { eq } from "drizzle-orm";

const REMINDER_HOURS = [
  { value: 6, label: "6:00 AM" },
  { value: 9, label: "9:00 AM" },
  { value: 12, label: "12:00 PM" },
  { value: 18, label: "6:00 PM" },
  { value: 21, label: "9:00 PM" },
];

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [row] = await db
      .select()
      .from(goalReminderSettingsTable)
      .where(eq(goalReminderSettingsTable.userId, userId));

    return NextResponse.json({
      enabled: row?.enabled ?? false,
      localHour: row?.localHour ?? 9,
      timezone: row?.timezone ?? "UTC",
      options: REMINDER_HOURS,
    });
  } catch (err) {
    console.error("Reminder settings GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { enabled, localHour, timezone } = body as {
      enabled?: boolean;
      localHour?: number;
      timezone?: string;
    };

    const now = new Date();
    const [existing] = await db
      .select()
      .from(goalReminderSettingsTable)
      .where(eq(goalReminderSettingsTable.userId, userId));

    const nextEnabled = typeof enabled === "boolean" ? enabled : (existing?.enabled ?? false);
    const nextLocalHour =
      typeof localHour === "number" && localHour >= 0 && localHour <= 23
        ? localHour
        : (existing?.localHour ?? 9);
    const nextTimezone =
      typeof timezone === "string" && timezone.trim() ? timezone.trim() : (existing?.timezone ?? "UTC");

    const [row] = existing
      ? await db
          .update(goalReminderSettingsTable)
          .set({
            enabled: nextEnabled,
            localHour: nextLocalHour,
            timezone: nextTimezone,
            updatedAt: now,
          })
          .where(eq(goalReminderSettingsTable.userId, userId))
          .returning()
      : await db
          .insert(goalReminderSettingsTable)
          .values({
            userId,
            enabled: nextEnabled,
            localHour: nextLocalHour,
            timezone: nextTimezone,
            updatedAt: now,
          })
          .returning();

    return NextResponse.json({
      enabled: row.enabled,
      localHour: row.localHour,
      timezone: row.timezone,
    });
  } catch (err) {
    console.error("Reminder settings PATCH error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update settings" },
      { status: 500 }
    );
  }
}
