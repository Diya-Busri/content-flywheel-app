"use client";

import React from "react";
import { DashboardThemeProvider } from "@/components/dashboard-theme-provider";
import Sidebar from "@/components/sidebar";
import { DashboardReviewPopup } from "@/components/dashboard-review-popup";
import { WelcomeModal } from "@/components/welcome-modal";
import { SelectProfile } from "@/db/schema/profiles-schema";

interface DashboardLayoutClientProps {
  profile: SelectProfile | null;
  userEmail: string;
  children: React.ReactNode;
}

export function DashboardLayoutClient({ profile, userEmail, children }: DashboardLayoutClientProps) {
  return (
    <DashboardThemeProvider className="flex h-screen relative overflow-hidden bg-[#F9FAFB] dark:bg-[#0F0F0F]">
      <WelcomeModal />
      <DashboardReviewPopup profile={profile} />
      <Sidebar profile={profile} userEmail={userEmail} />
      <div className="flex-1 overflow-auto relative bg-[#F9FAFB] dark:bg-[#0F0F0F] text-gray-900 dark:text-white">
        {children}
      </div>
    </DashboardThemeProvider>
  );
}
