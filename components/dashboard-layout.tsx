/**
 * Dashboard layout component for Template App
 * Provides a consistent layout structure for all dashboard pages
 * Features a sidebar navigation and main content area
 */
import { ReactNode } from "react";
import Sidebar from "@/components/sidebar";
import { SelectProfile } from "@/db/schema/profiles-schema";
import dynamic from "next/dynamic";

// We no longer need to dynamically import the upgrade popup as it's handled by the sidebar component

interface DashboardLayoutProps {
  profile: SelectProfile | null;
  children: ReactNode;
  title: string;
}

export default function DashboardLayout({ profile, children, title }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50 relative">
      {/* Sidebar - now handles showing the upgrade popup */}
      <Sidebar
        profile={profile}
      />
      
      {/* Main Content */}
      <div className="flex-1 overflow-auto relative">
        <main className="p-6 md:p-10">
          <h1 className="text-3xl font-bold mb-8">{title}</h1>
          {children}
        </main>
      </div>
    </div>
  );
} 