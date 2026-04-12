import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import CopyWriterClient from "./CopyWriterClient";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Copy Writer | Content Studio | Content Flywheel",
  description: "AI-generated titles and SEO-optimized descriptions with CTR variations, timestamps, and CTA suggestions",
};

export default function CopyWriterPage() {
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
        Copy Writer
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        AI-generated titles optimized for CTR, SEO descriptions with keywords, multiple title styles (curiosity, direct, clickbait), character counts per platform, auto-timestamps from script, and CTA suggestions.
      </p>
      <CopyWriterClient />
    </main>
  );
}
