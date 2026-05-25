/**
 * Dashboard layout for Template App
 * This layout removes the global header from all dashboard pages
 * and applies the dashboard-specific styling
 */
import React, { ReactNode } from "react";
import { getProfileByUserId } from "@/db/queries/profiles-queries";
import { createProfileAction } from "@/actions/profiles-actions";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardLayoutClient } from "@/components/dashboard-layout-client";
import { DashboardSetupError } from "@/components/dashboard-setup-error";
import { DashboardUpgradeWall } from "@/components/dashboard-upgrade-wall";
import { getDisabledFeatures } from "@/lib/feature-flags";
import { getHiddenFeaturesByUseCases, USE_CASES } from "@/lib/use-cases";

/** Paywall: user must have an active subscription to access the dashboard. */
function hasActiveSubscription(profile: any | null): boolean {
  if (!profile) return false;
  const status = (profile.status ?? "").toLowerCase();
  const activeStatuses = ["active", "trialing"];
  return profile.membership === "pro" && activeStatuses.includes(status);
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { userId } = await auth();

  if (!userId) {
    return redirect("/sign-in");
  }

  let profile: Awaited<ReturnType<typeof getProfileByUserId>> = null;
  try {
    profile = await getProfileByUserId(userId);
  } catch (e) {
    console.error("Dashboard: getProfileByUserId failed", e);
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4">
        <h2 className="text-lg font-semibold">Unable to load dashboard</h2>
        <p className="text-center text-sm text-muted-foreground">
          Profile could not be loaded. This is often due to a temporary database or server issue.
        </p>
        <a href="/dashboard" className="text-sm text-primary underline hover:no-underline">
          Try again
        </a>
      </div>
    );
  }

  // If no profile, try creating one (handles race with root layout)
  if (!profile) {
    try {
      const user = await currentUser();
      const email = user?.emailAddresses?.[0]?.emailAddress;
      const res = await createProfileAction(email ? { userId, email } : { userId });
      if (res.data) profile = res.data;
    } catch (e) {
      console.error("Dashboard: profile creation failed", e);
    }
    if (!profile) {
      return <DashboardSetupError />;
    }
  }

  // Block suspended users
  if (profile.status === "suspended") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="text-5xl">🚫</div>
        <h2 className="text-lg font-semibold">Account Suspended</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Your account has been suspended. Please contact support if you think this is a mistake.
        </p>
        <a href="mailto:support@contentflywheel.co.uk" className="text-sm text-orange-500 underline hover:no-underline">
          Contact Support
        </a>
      </div>
    );
  }

  const user = await currentUser();
  const userEmail = user?.emailAddresses?.[0]?.emailAddress || "";

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  const isAdmin = adminEmail && userEmail.trim().toLowerCase() === adminEmail;

  if (!isAdmin && !hasActiveSubscription(profile)) {
    return <DashboardUpgradeWall userEmail={userEmail} />;
  }

  const disabledFeatures = await getDisabledFeatures(userId);

  // Apply user's use-case preferences on top of admin feature flags
  const selectedUseCases: string[] | null = profile.enabledFeatures
    ? JSON.parse(profile.enabledFeatures)
    : null;
  const userHidden = getHiddenFeaturesByUseCases(selectedUseCases);

  // Admin flags always win — user use-case selections cannot override a global OFF flag.
  // userHidden are features hidden because the user hasn't selected a relevant use case.
  // User explicit keys only override userHidden (use-case hiding), not admin flags.
  const userExplicitKeys = selectedUseCases && selectedUseCases.length > 0
    ? new Set(USE_CASES.filter(uc => selectedUseCases.includes(uc.id)).flatMap(uc => uc.featureKeys))
    : new Set<string>();
  const effectiveUserHidden = new Set(Array.from(userHidden).filter(k => !userExplicitKeys.has(k)));

  // Admin always sees everything — feature flags only apply to regular users
  const allDisabled = isAdmin ? [] : Array.from(new Set([...Array.from(effectiveUserHidden), ...Array.from(disabledFeatures)]));

  return (
    <DashboardLayoutClient profile={profile} userEmail={userEmail} disabledFeatures={allDisabled} isAdmin={!!isAdmin}>
      {children}
    </DashboardLayoutClient>
  );
} 