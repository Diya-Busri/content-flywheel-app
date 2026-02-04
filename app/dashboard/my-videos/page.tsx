/**
 * My Videos - List of all generated videos
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, ArrowLeft, Play } from "lucide-react";

export const metadata: Metadata = {
  title: "My Videos | Content Flywheel",
  description: "View and manage your generated videos",
};

export default function MyVideosPage() {
  return (
    <main className="p-6 md:p-10">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-orange-500 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to dashboard
      </Link>
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
        My Videos
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-10">
        All your generated videos in one place
      </p>
      <div className="max-w-2xl">
        <Card className="border-slate-200 dark:border-slate-800 border-dashed">
          <CardContent className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <Video className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-2 font-medium">
              No videos yet. Create your first video to get started!
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500 mb-6">
              Your generated videos will appear here
            </p>
            <Button
              asChild
              className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
            >
              <Link href="/dashboard/digital-products">
                <Play className="w-4 h-4" />
                Create Video
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
