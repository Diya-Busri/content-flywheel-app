"use client";

import { SignOutButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

/**
 * Shown when user is signed in but profile creation failed.
 * Breaks the redirect loop (dashboard → sign-up → dashboard).
 */
export function DashboardSetupError() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-4 dark:bg-slate-950">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
        Account setup incomplete
      </h1>
      <p className="max-w-sm text-center text-sm text-slate-600 dark:text-slate-400">
        We couldn&apos;t create your profile. This may be due to a database connection issue. Try
        signing out and back in, or check that your database is configured.
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
        <SignOutButton>
          <Button variant="default">Sign out</Button>
        </SignOutButton>
      </div>
    </div>
  );
}
