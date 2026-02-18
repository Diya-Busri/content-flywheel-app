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
  // Fetch user profile once at the layout level
  const { userId } = auth();

  if (!userId) {
    return redirect("/sign-in");
  }

  let profile = await getProfileByUserId(userId);

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

  // Get the current user (needed for email and for admin bypass)
  const user = await currentUser();
  const userEmail = user?.emailAddresses?.[0]?.emailAddress || "";

  // Admin bypass: if user email matches ADMIN_EMAIL, allow full access without subscription
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const isAdmin = adminEmail && userEmail.trim().toLowerCase() === adminEmail;

  // Paywall: redirect to pricing if not admin and user does not have an active subscription
  if (!isAdmin && !hasActiveSubscription(profile)) {
    redirect("/pricing");
  }

  return (
    <DashboardLayoutClient profile={profile} userEmail={userEmail}>
      {children}
    </DashboardLayoutClient>
  );
} 