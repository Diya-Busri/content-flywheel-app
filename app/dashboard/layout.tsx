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

/** Paywall: user must have an active subscription to access the dashboard. */
function hasActiveSubscription(profile: any | null): boolean {
  if (!profile) return false;
  const status = (profile.status ?? "").toLowerCase();
  const activeStatuses = ["active", "trialing"];
  return profile.membership === "pro" && activeStatuses.includes(status);
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { userId } = auth();

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

  const user = await currentUser();
  const userEmail = user?.emailAddresses?.[0]?.emailAddress || "";

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  const isAdmin = adminEmail && userEmail.trim().toLowerCase() === adminEmail;

  if (!isAdmin && !hasActiveSubscription(profile)) {
    redirect("/pricing");
  }

  return (
    <DashboardLayoutClient profile={profile} userEmail={userEmail}>
      {children}
    </DashboardLayoutClient>
  );
} 