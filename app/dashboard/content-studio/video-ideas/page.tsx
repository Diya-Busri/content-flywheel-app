import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import VideoIdeasClient from "./VideoIdeasClient";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Video ideas | Content Studio | Content Flywheel",
  description: "Generate unlimited video ideas for your niche with hooks, psychology, and engagement estimates",
};

export default function VideoIdeasPage() {
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
        Video ideas
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        <strong className="text-foreground">Start here.</strong> You need ideas before you can create videos. AI generates 20 ideas for your niche with hook, why it works, and estimated views. Use &quot;Generate Script&quot; to go straight to Video Timeline, or save ideas to the calendar. Complete flow: Idea → Script → Video.
      </p>
      <VideoIdeasClient />
    </main>
  );
}
