import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import TrendsClient from "./TrendsClient";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Trends | Content Studio | Content Flywheel",
  description: "Real-time trending topics in your niche. TikTok, YouTube, Instagram. Lifecycle, hashtags, sounds, formats, historical data.",
};

export default function TrendsPage() {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  return (
    <main className="p-6 md:p-10">
      <Link
        href="/dashboard/content-studio"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Content Studio
      </Link>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        Trends
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Real-time trending topics in your niche. Platform-specific (TikTok, YouTube Shorts, Instagram Reels), trend lifecycle (rising, peak, declining), suggested angles, trending hashtags, sounds, and formats. Plus historical data on what worked last year. Integration-ready for TikTok Trends API, YouTube Trending API, and Google Trends.
      </p>
      <TrendsClient />
    </main>
  );
}
