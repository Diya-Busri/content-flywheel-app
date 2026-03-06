import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import SeoClient from "./SeoClient";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "SEO & Keywords | Content Studio | Content Flywheel",
  description: "Keyword research, search volume, competition, platform hashtags (TikTok, YouTube, Instagram), save hashtag groups",
};

export default function SeoPage() {
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
        SEO & Keywords
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Keyword research for your video topic: search volume, competition, related and long-tail keywords. YouTube autocomplete, TikTok and Instagram hashtags. Copy hashtag sets and save groups for reuse.
      </p>
      <SeoClient />
    </main>
  );
}
