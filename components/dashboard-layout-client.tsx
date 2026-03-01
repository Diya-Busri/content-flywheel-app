"use client";

import React, { useState } from "react";
import { DashboardThemeProvider } from "@/components/dashboard-theme-provider";
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
  return (
    <DashboardThemeProvider className="flex h-screen relative overflow-hidden bg-[#F9FAFB] dark:bg-[#0F0F0F]">
      <OnboardingProvider markDashboardSeen>
        <DashboardReviewPopup
        profile={profile}
        open={showReviewPopup}
        onOpenChange={setShowReviewPopup}
      />
      <Sidebar profile={profile} userEmail={userEmail} onOpenReview={() => setShowReviewPopup(true)} />
      <div className="flex-1 overflow-auto relative bg-[#F9FAFB] dark:bg-[#0F0F0F] text-gray-900 dark:text-white">
        {children}
      </div>
      </OnboardingProvider>
    </DashboardThemeProvider>
  );
}
