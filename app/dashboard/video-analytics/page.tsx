/**
 * Video Analytics – metrics for published videos across platforms
 * Matches Digital Products / dashboard styling: total views, engagement, best videos, platform breakdown, growth.
 */
import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { FeaturePreviewGate } from "@/components/feature-preview-gate";
import { VideoAnalyticsClient } from "./VideoAnalyticsClient";

export const metadata: Metadata = {
  title: "Video Analytics | Content Flywheel",
  description: "Metrics for your published videos across TikTok, YouTube, and Instagram",
};

export default async function VideoAnalyticsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <FeaturePreviewGate title="Video Analytics">
      {/* Full page content (revealed when unlocked) */}
      <main className="p-6 md:p-10">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Video Analytics
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-10">
          Performance of your published videos across all platforms
        </p>
        <VideoAnalyticsClient />
      </main>
    </FeaturePreviewGate>
  );
}
