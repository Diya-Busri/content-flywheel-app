"use client";

/**
 * Layout Wrapper component for Template App
 * Controls when to show the header based on the current URL path
 * Prevents header from appearing on dashboard pages
 */
import { ReactNode } from "react";
import { TourRunner } from "@/components/help/TourRunner";
import { TourCompleteModal, DemoRunner } from "@/components/help/TourCompleteModal";
import { OnboardingTrigger } from "@/components/help/OnboardingTrigger";

interface LayoutWrapperProps {
  children: ReactNode;
}

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  return (
    <div className="min-w-0 overflow-x-hidden">
      <OnboardingTrigger />
      <TourRunner />
      <DemoRunner />
      <TourCompleteModal />
      {children}
    </div>
  );
} 