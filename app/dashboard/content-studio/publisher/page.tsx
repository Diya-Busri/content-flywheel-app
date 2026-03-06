import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import PublisherClient from "./PublisherClient";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Publisher | Content Studio | Content Flywheel",
  description: "Publish one video to all platforms with platform-specific options. TikTok, YouTube, Instagram, Facebook. Cross-post or bulk upload.",
};

export default function PublisherPage() {
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
        Publisher
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Publish one video to all platforms or bulk upload. Connect TikTok, YouTube, Instagram, and Facebook in Settings. Customize per platform: vertical crop, thumbnail, chapters, captions, music.
      </p>
      <PublisherClient />
    </main>
  );
}
