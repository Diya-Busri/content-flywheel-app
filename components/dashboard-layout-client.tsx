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
import { BundleProgressBanner } from "@/components/dashboard/BundleProgressBanner";
import { AnalyticsTracker } from "@/components/analytics-tracker";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { SelectProfile } from "@/db/schema/profiles-schema";

interface DashboardLayoutClientProps {
  profile: SelectProfile | null;
  userEmail: string;
  disabledFeatures?: string[];
  isAdmin?: boolean;
  children: React.ReactNode;
}

export function DashboardLayoutClient({ profile, userEmail, disabledFeatures = [], isAdmin = false, children }: DashboardLayoutClientProps) {
  const [showReviewPopup, setShowReviewPopup] = useState(false);
  const pathname = usePathname();
  const isVideoTimeline = pathname?.includes("/video-timeline") ?? false;
  const isProductEditor = /\/digital-products\/[^/]+\/edit/.test(pathname ?? "") || /\/design-studio\/[^/]+/.test(pathname ?? "");
  const needsFullHeight = isVideoTimeline || isProductEditor;
  return (
    <DashboardThemeProvider
      className="flex min-w-0 relative overflow-x-hidden overflow-y-hidden bg-[#F9FAFB] dark:bg-[#0F0F0F]"
      style={{ display: "flex", flexDirection: "row", height: "100dvh", minHeight: 0 }}
    >
      <SidebarProvider>
        <ServiceWorkerRegister />
        <VideoNotificationWatcher />
        <OnboardingProvider markDashboardSeen hasActiveSubscription={isAdmin || !!(profile?.stripeSubscriptionId || profile?.whopMembershipId)}>
          <DashboardReviewPopup
          profile={profile!}
          open={showReviewPopup}
          onOpenChange={setShowReviewPopup}
        />
        <Sidebar profile={profile} userEmail={userEmail} disabledFeatures={disabledFeatures} onOpenReview={() => setShowReviewPopup(true)} isAdmin={isAdmin} />
        <main
          className={`z-0 flex-1 min-w-0 min-h-0 flex flex-col max-w-full relative bg-[#F9FAFB] dark:bg-[#0F0F0F] text-gray-900 dark:text-white md:pb-0 ${needsFullHeight ? "overflow-hidden" : "pb-mobile-nav overflow-x-hidden overflow-y-auto"}`}
          style={{ minWidth: 0, minHeight: 0, flex: "1 1 0%" }}
        >
          <AnalyticsTracker />
          <AnnouncementBanner />
          <BundleProgressBanner />
          {children}
          <FeedbackWidget />
        </main>
        </OnboardingProvider>
      </SidebarProvider>
    </DashboardThemeProvider>
  );
}
