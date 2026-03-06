import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ContentStudioAnalyticsClient from "./ContentStudioAnalyticsClient";

export const metadata: Metadata = {
  title: "Analytics | Content Studio | Content Flywheel",
  description:
    "Overall performance, per-video analytics, best performing content, platform comparison, and AI insights",
};

export default function ContentStudioAnalyticsPage() {
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
        Analytics
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Overall performance, per-video metrics, best performing content,
        TikTok vs YouTube comparison, and AI-powered insights.
      </p>
      <ContentStudioAnalyticsClient />
    </main>
  );
}
