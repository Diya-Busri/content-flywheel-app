"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getProfileByUserId } from "@/db/queries/profiles-queries";
import { getUserSettings, getUserSettingsForDisplay, upsertUserSettings } from "@/db/queries/user-settings-queries";
import { db } from "@/db/db";
import { userSettingsTable } from "@/db/schema/user-settings-schema";
import { productsTable } from "@/db/schema/products-schema";
import { scriptsTable, videosTable, tiktokShopVideosTable } from "@/db/schema/library-schema";
import { videoJobsTable } from "@/db/schema/video-jobs-schema";
import { eq } from "drizzle-orm";

export type SettingsDisplay = {
  displayName: string | null;
  openaiApiKeyMasked: string | null;
  shotstackApiKeyMasked: string | null;
  defaultProductType: string;
  defaultVideoStyle: string;
};

export type ProfileForSettings = {
  membership: string;
  status: string | null;
  planDuration: string | null;
  billingCycleEnd: Date | null;
  stripeCustomerId: string | null;
};

export async function getSettingsForPage(): Promise<{
  profile: ProfileForSettings | null;
  settings: SettingsDisplay | null;
  settingsTableMissing?: boolean;
}> {
  const { userId } = await auth();
  if (!userId) return { profile: null, settings: null };
  let profile: Awaited<ReturnType<typeof getProfileByUserId>> = null;
  try {
    profile = await getProfileByUserId(userId);
  } catch {
    // ignore
  }
  let settings: Awaited<ReturnType<typeof getUserSettingsForDisplay>> = null;
  try {
    settings = await getUserSettingsForDisplay(userId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("user_settings") && msg.includes("does not exist")) {
      return {
        profile: profile
          ? {
              membership: profile.membership ?? "free",
              status: profile.status ?? null,
              planDuration: profile.planDuration ?? null,
              billingCycleEnd: profile.billingCycleEnd ?? null,
              stripeCustomerId: profile.stripeCustomerId ?? null,
            }
          : null,
        settings: {
          displayName: null,
          openaiApiKeyMasked: null,
          shotstackApiKeyMasked: null,
          defaultProductType: "digital_product",
          defaultVideoStyle: "professional",
        },
        settingsTableMissing: true,
      };
    }
    throw err;
  }
  return {
    profile: profile
      ? {
          membership: profile.membership ?? "free",
          status: profile.status ?? null,
          planDuration: profile.planDuration ?? null,
          billingCycleEnd: profile.billingCycleEnd ?? null,
          stripeCustomerId: profile.stripeCustomerId ?? null,
        }
      : null,
    settings: settings ?? {
      displayName: null,
      openaiApiKeyMasked: null,
      shotstackApiKeyMasked: null,
      defaultProductType: "digital_product",
      defaultVideoStyle: "professional",
    },
  };
}

export async function saveProfileAction(displayName: string | null): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Not signed in" };
    await upsertUserSettings(userId, { displayName: displayName?.trim() || null });
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to save" };
  }
}

/** Pass a string to update (empty string clears). Pass undefined to leave unchanged. */
export async function saveApiKeysAction(
  openaiApiKey?: string | null,
  shotstackApiKey?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Not signed in" };
    const updates: { openaiApiKey?: string | null; shotstackApiKey?: string | null } = {};
    if (openaiApiKey !== undefined) updates.openaiApiKey = openaiApiKey?.trim() || null;
    if (shotstackApiKey !== undefined) updates.shotstackApiKey = shotstackApiKey?.trim() || null;
    await upsertUserSettings(userId, updates);
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to save" };
  }
}

export async function savePreferencesAction(
  defaultProductType: string,
  defaultVideoStyle: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Not signed in" };
    await upsertUserSettings(userId, {
      defaultProductType: defaultProductType || "digital_product",
      defaultVideoStyle: defaultVideoStyle || "professional",
    });
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to save" };
  }
}

export async function clearAllDataAction(): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Not signed in" };
    await db.delete(videoJobsTable).where(eq(videoJobsTable.userId, userId));
    await db.delete(tiktokShopVideosTable).where(eq(tiktokShopVideosTable.userId, userId));
    await db.delete(videosTable).where(eq(videosTable.userId, userId));
    await db.delete(scriptsTable).where(eq(scriptsTable.userId, userId));
    await db.delete(productsTable).where(eq(productsTable.userId, userId));
    await db.delete(userSettingsTable).where(eq(userSettingsTable.userId, userId));
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/library");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to clear data" };
  }
}

export async function deleteAccountAction(): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Not signed in" };
    await clearAllDataAction();
    const { clerkClient } = await import("@clerk/nextjs/server");
    await clerkClient().users.deleteUser(userId);
    const { profilesTable } = await import("@/db/schema/profiles-schema");
    await db.delete(profilesTable).where(eq(profilesTable.userId, userId));
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to delete account" };
  }
}
