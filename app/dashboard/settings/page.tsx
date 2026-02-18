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
  const { userId } = auth();
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
        settingsTableMissing={settingsTableMissing}
      />
    </main>
  );
}

function SettingsTableMissingBanner() {
  const sql = `CREATE TABLE IF NOT EXISTS "user_settings" (
  "user_id" text PRIMARY KEY REFERENCES "profiles"("user_id") ON DELETE CASCADE,
  "display_name" text,
  "openai_api_key" text,
  "shotstack_api_key" text,
  "default_product_type" text NOT NULL DEFAULT 'digital_product',
  "default_video_style" text NOT NULL DEFAULT 'professional',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);`;
  return (
    <div className="mb-8 p-4 rounded-lg bg-amber-950/40 border border-amber-800">
      <p className="font-semibold text-amber-200 mb-2">
        Database setup required
      </p>
      <p className="text-sm text-amber-300 mb-3">
        The <code className="bg-amber-900/50 px-1 rounded">user_settings</code> table is missing. Create it in the same database your app uses (check <code className="bg-amber-900/50 px-1 rounded">DATABASE_URL</code> in .env.local).
      </p>
      <p className="text-sm text-amber-300 mb-2">
        <strong>Option 1:</strong> From project root run: <code className="bg-amber-900/50 px-1 rounded">npm run db:settings</code>
      </p>
      <p className="text-sm text-amber-300 mb-2">
        <strong>Option 2 (Supabase):</strong> In Supabase Dashboard → SQL Editor, run:
      </p>
      <pre className="text-xs p-3 bg-gray-100 dark:bg-[#0F0F0F] text-gray-800 dark:text-gray-300 rounded overflow-x-auto">
        {sql}
      </pre>
    </div>
  );
}
