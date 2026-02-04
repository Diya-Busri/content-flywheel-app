/**
 * Dashboard home page for Content Flywheel
 * Displays quick stats, quick actions, and recent videos
 */
import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { getProfileByUserId } from "@/db/queries/profiles-queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, ShoppingBag, CheckSquare, Video, Play } from "lucide-react";

export const metadata: Metadata = {
  title: "Dashboard | Content Flywheel",
  description: "Create AI-powered videos for social media",
};

export default async function DashboardPage() {
  const { userId } = auth();
  const profile = userId ? await getProfileByUserId(userId) : null;

  const usedCredits = profile?.usedCredits ?? 0;
  const usageCredits = profile?.usageCredits ?? 3; // Free tier default
  const creditsRemaining = Math.max(0, usageCredits - usedCredits);

  return (
    <main className="p-6 md:p-10">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
        Welcome back
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-10">
        Create AI-powered videos for TikTok, Instagram, and YouTube
      </p>

      {/* Quick Stats */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Quick Stats
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Videos Generated
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {usedCredits}/{usageCredits}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Free tier
              </p>
            </CardContent>
          </Card>
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Total Views
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                Coming soon
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Track performance across platforms
              </p>
            </CardContent>
          </Card>
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Credits Remaining
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-orange-500">
                {creditsRemaining} free videos left
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Resets monthly
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/dashboard/digital-products">
            <Card className="group cursor-pointer border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg hover:border-orange-200 dark:hover:border-orange-900/50 transition-all overflow-hidden h-full">
              <CardContent className="p-8 flex flex-col items-center justify-center text-center min-h-[180px]">
                <div className="w-14 h-14 rounded-xl bg-orange-100 dark:bg-orange-950/50 flex items-center justify-center mb-4 group-hover:bg-orange-200 dark:group-hover:bg-orange-900/50 transition-colors">
                  <Package className="w-7 h-7 text-orange-500" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
                  Create Digital Product Video
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Flow 1 — Turn your digital products into sales-driving videos
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/dashboard/tiktok-shop">
            <Card className="group cursor-pointer border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg hover:border-orange-200 dark:hover:border-orange-900/50 transition-all overflow-hidden h-full">
              <CardContent className="p-8 flex flex-col items-center justify-center text-center min-h-[180px]">
                <div className="w-14 h-14 rounded-xl bg-orange-100 dark:bg-orange-950/50 flex items-center justify-center mb-4 group-hover:bg-orange-200 dark:group-hover:bg-orange-900/50 transition-colors">
                  <ShoppingBag className="w-7 h-7 text-orange-500" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
                  Generate TikTok Shop Video
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Flow 2 — Create videos optimized for TikTok Shop
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/dashboard/script-checker">
            <Card className="group cursor-pointer border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg hover:border-orange-200 dark:hover:border-orange-900/50 transition-all overflow-hidden h-full">
              <CardContent className="p-8 flex flex-col items-center justify-center text-center min-h-[180px]">
                <div className="w-14 h-14 rounded-xl bg-orange-100 dark:bg-orange-950/50 flex items-center justify-center mb-4 group-hover:bg-orange-200 dark:group-hover:bg-orange-900/50 transition-colors">
                  <CheckSquare className="w-7 h-7 text-orange-500" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
                  Check Script Compliance
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Flow 3 — Ensure your scripts meet platform guidelines
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>

      {/* Recent Videos */}
      <section>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Recent Videos
        </h2>
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm border-dashed">
          <CardContent className="p-12 flex flex-col items-center justify-center text-center min-h-[200px]">
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
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Link href="/dashboard/digital-products" className="gap-2">
                <Play className="w-4 h-4" />
                Create Video
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
