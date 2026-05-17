"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { DashboardThemeProvider } from "@/components/dashboard-theme-provider";
import { SidebarProvider } from "@/components/sidebar-context";
import Sidebar from "@/components/sidebar";
import { DashboardReviewPopup } from "@/components/dashboard-review-popup";
import { OnboardingProvider } from "@/components/onboarding/onboarding-provider";
import { VideoNotificationWatcher } from "@/components/video-notification-watcher";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { SelectProfile } from "@/db/schema/profiles-schema";

interface DashboardLayoutClientProps {
  profile: SelectProfile | null;
  userEmail: string;
  disabledFeatures?: string[];
  children: React.ReactNode;
}

export function DashboardLayoutClient({ profile, userEmail, disabledFeatures = [], children }: DashboardLayoutClientProps) {
  const [showReviewPopup, setShowReviewPopup] = useState(false);
  const pathname = usePathname();
  const isVideoTimeline = pathname?.includes("/video-timeline") ?? false;
  const isProductEditor = /\/digital-products\/[^/]+\/edit/.test(pathname ?? "");
  const needsFullHeight = isVideoTimeline || isProductEditor;
  return (
    <DashboardThemeProvider
      className="flex h-screen min-w-0 relative overflow-x-hidden overflow-y-hidden bg-[#F9FAFB] dark:bg-[#0F0F0F]"
      style={{ display: "flex", flexDirection: "row", height: "100vh", minHeight: 0 }}
    >
      <SidebarProvider>
        <VideoNotificationWatcher />
        <OnboardingProvider markDashboardSeen hasActiveSubscription={!!(profile?.stripeSubscriptionId || profile?.whopMembershipId)}>
          <DashboardReviewPopup
          profile={profile}
          open={showReviewPopup}
          onOpenChange={setShowReviewPopup}
        />
        <Sidebar profile={profile} userEmail={userEmail} disabledFeatures={disabledFeatures} onOpenReview={() => setShowReviewPopup(true)} />
        <main
          className={`z-0 flex-1 min-w-0 min-h-0 flex flex-col max-w-full relative bg-[#F9FAFB] dark:bg-[#0F0F0F] text-gray-900 dark:text-white ${needsFullHeight ? "overflow-hidden" : "overflow-x-hidden overflow-y-auto"}`}
          style={{ minWidth: 0, minHeight: 0, flex: "1 1 0%" }}
        >
          <AnnouncementBanner />
          {children}
          <FeedbackWidget />
        </main>
        </OnboardingProvider>
      </SidebarProvider>
    </DashboardThemeProvider>
  );
}
