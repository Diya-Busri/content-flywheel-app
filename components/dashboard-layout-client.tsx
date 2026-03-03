"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { DashboardThemeProvider } from "@/components/dashboard-theme-provider";
import { SidebarProvider } from "@/components/sidebar-context";
import Sidebar from "@/components/sidebar";
import { DashboardReviewPopup } from "@/components/dashboard-review-popup";
import { OnboardingProvider } from "@/components/onboarding/onboarding-provider";
import { SelectProfile } from "@/db/schema/profiles-schema";

interface DashboardLayoutClientProps {
  profile: SelectProfile | null;
  userEmail: string;
  children: React.ReactNode;
}

export function DashboardLayoutClient({ profile, userEmail, children }: DashboardLayoutClientProps) {
  const [showReviewPopup, setShowReviewPopup] = useState(false);
  const pathname = usePathname();
  const isVideoTimeline = pathname?.includes("/video-timeline") ?? false;
  return (
    <DashboardThemeProvider className="flex h-screen min-w-0 relative overflow-x-hidden overflow-y-hidden bg-[#F9FAFB] dark:bg-[#0F0F0F]">
      <SidebarProvider>
        <OnboardingProvider markDashboardSeen>
          <DashboardReviewPopup
          profile={profile}
          open={showReviewPopup}
          onOpenChange={setShowReviewPopup}
        />
        <Sidebar profile={profile} userEmail={userEmail} onOpenReview={() => setShowReviewPopup(true)} />
        <div
          className={`flex-1 min-w-0 max-w-full relative bg-[#F9FAFB] dark:bg-[#0F0F0F] text-gray-900 dark:text-white ${isVideoTimeline ? "overflow-hidden" : "overflow-x-hidden overflow-y-auto"}`}
        >
          {children}
        </div>
        </OnboardingProvider>
      </SidebarProvider>
    </DashboardThemeProvider>
  );
}
