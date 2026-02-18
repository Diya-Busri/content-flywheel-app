import { db } from "@/db/db";
import { userSettingsTable } from "@/db/schema/user-settings-schema";
import { eq } from "drizzle-orm";
import type { InsertUserSettings, SelectUserSettings } from "@/db/schema/user-settings-schema";

export async function getUserSettings(userId: string): Promise<SelectUserSettings | null> {
  const [row] = await db.select().from(userSettingsTable).where(eq(userSettingsTable.userId, userId)).limit(1);
  return row ?? null;
}

/** Returns settings with API keys masked (last 4 chars only) for display. */
export async function getUserSettingsForDisplay(userId: string): Promise<{
  displayName: string | null;
  openaiApiKeyMasked: string | null;
  defaultProductType: string;
  defaultVideoStyle: string;
} | null> {
  const row = await getUserSettings(userId);
  if (!row) return null;
  const mask = (key: string | null) =>
    key && key.length > 4 ? "••••••••" + key.slice(-4) : key ? "••••" : null;
  return {
    displayName: row.displayName ?? null,
    openaiApiKeyMasked: mask(row.openaiApiKey),
    defaultProductType: row.defaultProductType ?? "digital_product",
    defaultVideoStyle: row.defaultVideoStyle ?? "professional",
  };
}

export async function upsertUserSettings(
  userId: string,
  data: Partial<Omit<InsertUserSettings, "userId" | "createdAt" | "updatedAt">>
): Promise<SelectUserSettings> {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (data.displayName !== undefined) set.displayName = data.displayName;
  if (data.openaiApiKey !== undefined) set.openaiApiKey = data.openaiApiKey;
  if (data.defaultProductType !== undefined) set.defaultProductType = data.defaultProductType;
  if (data.defaultVideoStyle !== undefined) set.defaultVideoStyle = data.defaultVideoStyle;

  const [existing] = await db.select().from(userSettingsTable).where(eq(userSettingsTable.userId, userId)).limit(1);
  if (existing) {
    const [row] = await db.update(userSettingsTable).set(set).where(eq(userSettingsTable.userId, userId)).returning();
    if (!row) throw new Error("Failed to update user settings");
    return row;
  }
  const [row] = await db
    .insert(userSettingsTable)
    .values({
      userId,
      displayName: data.displayName ?? null,
      openaiApiKey: data.openaiApiKey ?? null,
      defaultProductType: data.defaultProductType ?? "digital_product",
      defaultVideoStyle: data.defaultVideoStyle ?? "professional",
    })
    .returning();
  if (!row) throw new Error("Failed to insert user settings");
  return row;
}
