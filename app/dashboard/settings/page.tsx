/**
 * Settings page: Profile, Plan & Billing, API Keys, Preferences, Danger Zone
 */
import type { Metadata } from "next";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getSettingsForPage } from "@/actions/settings-actions";
import SettingsContent from "./SettingsContent";

export const metadata: Metadata = {
  title: "Settings | Content Flywheel",
  description: "Manage your profile, plan, API keys, and preferences",
};

export default async function SettingsPage() {
  const { userId } = await auth();
  const user = userId ? await currentUser() : null;
  const data = userId ? await getSettingsForPage() : { profile: null, settings: null, settingsTableMissing: false };
  const { profile, settings, settingsTableMissing } = data;

  const userEmail = user?.emailAddresses?.[0]?.emailAddress ?? "";
  const userImageUrl = user?.imageUrl ?? null;

  return (
    <main className="p-6 md:p-10">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        Settings
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Manage your account, API keys, and preferences
      </p>
      {settingsTableMissing && (
        <SettingsTableMissingBanner />
      )}
      <SettingsContent
        profile={profile}
        settings={settings}
        userEmail={userEmail}
        userImageUrl={userImageUrl}
        userId={userId ?? ""}
        settingsTableMissing={settingsTableMissing}
      />
    </main>
  );
}

function SettingsTableMissingBanner() {
  // Show a clean user-facing message — never expose DB schema or SQL to end users.
  return (
    <div className="mb-8 p-4 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 flex items-start gap-3">
      <span className="text-amber-500 text-xl shrink-0 mt-0.5">⚠️</span>
      <div>
        <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm mb-1">
          Settings are temporarily unavailable
        </p>
        <p className="text-sm text-amber-700 dark:text-amber-400">
          We{"'"}re having trouble loading your preferences. This is usually resolved quickly — please refresh the page or try again in a moment. If the issue persists, contact{" "}
          <a href="mailto:support@contentflywheel.com" className="underline hover:no-underline">
            support@contentflywheel.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}
