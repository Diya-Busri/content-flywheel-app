import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import ThumbnailsClient from "./ThumbnailsClient";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Thumbnails | Content Studio | Content Flywheel",
  description: "Critical for CTR. AI thumbnail generator from video title, 3 A/B-ready variations, text overlay editor, export for YouTube/TikTok/Instagram.",
};

export default async function ThumbnailsPage() {
  const { userId } = await auth();
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
        Thumbnails
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        <strong className="text-foreground">Critical for CTR.</strong> AI thumbnail generator from your video title. Get 3 variations (A/B test ready), edit text overlay, and export for YouTube, TikTok, and Instagram. Attach to a video or use in A/B Testing to see which performs best.
      </p>
      <ThumbnailsClient />
    </main>
  );
}
