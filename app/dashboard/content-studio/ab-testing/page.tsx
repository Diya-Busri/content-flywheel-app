import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AbTestingClient from "./AbTestingClient";

export const metadata: Metadata = {
  title: "A/B Testing | Content Studio | Content Flywheel",
  description:
    "Test thumbnails, titles, hooks, posting times, and hashtags. Statistical significance and declare a winner with confidence %.",
};

export default function AbTestingPage() {
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
        A/B Testing
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Test thumbnails, titles, hooks, posting times, and hashtag combinations.
        System shows each variation to 50% of the audience; after 48 hours, declare
        a winner with statistical confidence and apply the winning variant.
      </p>
      <AbTestingClient />
    </main>
  );
}
