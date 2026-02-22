/**
 * Dashboard home page for Content Flywheel
 * Displays quick stats (synced with profile + DB), quick actions, and recent videos
 */
import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { videosTable, tiktokShopVideosTable } from "@/db/schema/library-schema";
import { videoJobsTable } from "@/db/schema/video-jobs-schema";
import { productsTable } from "@/db/schema/products-schema";
import { eq, desc, isNull, and, count } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, ShoppingBag, CheckSquare, Video, Play, ExternalLink } from "lucide-react";

export const metadata: Metadata = {
  title: "Dashboard | Content Flywheel",
  description: "Create AI-powered videos for social media",
};

type RecentVideoItem = {
  id: string;
  title: string;
  createdAt: Date;
  href: string;
  source: "library" | "ugc-lab" | "tiktok-shop";
};

async function getVideoStats(userId: string) {
  let libraryCount = 0;
  let ugcCount = 0;
  let tiktokCount = 0;
  let productsCount = 0;
  const recent: RecentVideoItem[] = [];

  try {
    const videoWhere = and(eq(videosTable.userId, userId), isNull(videosTable.deletedAt));
    const productWhere = and(eq(productsTable.userId, userId), isNull(productsTable.deletedAt));
    const [libraryVideos, ugcJobs, tiktokVideos, libCountRow, ugcCountRow, tiktokCountRow, productsCountRow] = await Promise.all([
      db.select({ id: videosTable.id, title: videosTable.title, createdAt: videosTable.createdAt }).from(videosTable).where(videoWhere).orderBy(desc(videosTable.createdAt)).limit(5),
      db.select({ id: videoJobsTable.id, hookPreview: videoJobsTable.hookPreview, createdAt: videoJobsTable.createdAt }).from(videoJobsTable).where(eq(videoJobsTable.userId, userId)).orderBy(desc(videoJobsTable.createdAt)).limit(5),
      db.select({ id: tiktokShopVideosTable.id, productLink: tiktokShopVideosTable.productLink, createdAt: tiktokShopVideosTable.createdAt }).from(tiktokShopVideosTable).where(eq(tiktokShopVideosTable.userId, userId)).orderBy(desc(tiktokShopVideosTable.createdAt)).limit(5),
      db.select({ count: count() }).from(videosTable).where(videoWhere),
      db.select({ count: count() }).from(videoJobsTable).where(eq(videoJobsTable.userId, userId)),
      db.select({ count: count() }).from(tiktokShopVideosTable).where(eq(tiktokShopVideosTable.userId, userId)),
      db.select({ count: count() }).from(productsTable).where(productWhere),
    ]);

    libraryCount = Number(libCountRow[0]?.count ?? 0);
    ugcCount = Number(ugcCountRow[0]?.count ?? 0);
    tiktokCount = Number(tiktokCountRow[0]?.count ?? 0);
    productsCount = Number(productsCountRow[0]?.count ?? 0);

    const withSource: RecentVideoItem[] = [
      ...libraryVideos.map((v) => ({ id: v.id, title: v.title || "Untitled video", createdAt: v.createdAt!, href: "/dashboard/library", source: "library" as const })),
      ...ugcJobs.map((j) => ({ id: j.id, title: (j.hookPreview || "UGC video").slice(0, 60) + (j.hookPreview && j.hookPreview.length > 60 ? "…" : ""), createdAt: j.createdAt!, href: "/dashboard/ugc-lab", source: "ugc-lab" as const })),
      ...tiktokVideos.map((v) => ({ id: v.id, title: (v.productLink || "TikTok Shop video").slice(0, 60) + (v.productLink && v.productLink.length > 60 ? "…" : ""), createdAt: v.createdAt!, href: "/dashboard/tiktok-shop", source: "tiktok-shop" as const })),
    ];
    recent.push(...withSource.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 5));
  } catch (err) {
    console.error("[dashboard] getVideoStats:", err);
  }

  const digitalProductsCount = productsCount;
  return { digitalProductsCount, tiktokShopCount: tiktokCount, recent };
}

export default async function DashboardPage() {
  const { userId } = auth();
  const videoStats = userId ? await getVideoStats(userId) : { digitalProductsCount: 0, tiktokShopCount: 0, recent: [] as RecentVideoItem[] };

  return (
    <main className="p-6 md:p-10">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        Welcome back
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-10">
        Create AI-powered videos for TikTok, Instagram, and YouTube
      </p>

      {/* Quick Stats */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Quick Stats
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] hover:border-gray-300 dark:hover:border-[#3A3A3A] transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Digital Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {videoStats.digitalProductsCount}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Videos & guides created
              </p>
            </CardContent>
          </Card>
          <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] hover:border-gray-300 dark:hover:border-[#3A3A3A] transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                TikTok Shop
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {videoStats.tiktokShopCount}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Videos & guides created
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/dashboard/digital-products">
            <Card className="group cursor-pointer border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] hover:border-orange-500/50 transition-all overflow-hidden h-full">
              <CardContent className="p-8 flex flex-col items-center justify-center text-center min-h-[180px]">
                <div className="w-14 h-14 rounded-xl bg-orange-500/20 flex items-center justify-center mb-4 group-hover:bg-orange-500/30 transition-colors">
                  <Package className="w-7 h-7 text-orange-500" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Create Digital Product Video
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Flow 1 — Turn your digital products into sales-driving videos
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/dashboard/tiktok-shop">
            <Card className="group cursor-pointer border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] hover:border-orange-500/50 transition-all overflow-hidden h-full">
              <CardContent className="p-8 flex flex-col items-center justify-center text-center min-h-[180px]">
                <div className="w-14 h-14 rounded-xl bg-orange-500/20 flex items-center justify-center mb-4 group-hover:bg-orange-500/30 transition-colors">
                  <ShoppingBag className="w-7 h-7 text-orange-500" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Generate TikTok Shop Video
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Flow 2 — Create videos optimized for TikTok Shop
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/dashboard/script-checker">
            <Card className="group cursor-pointer border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] hover:border-orange-500/50 transition-all overflow-hidden h-full">
              <CardContent className="p-8 flex flex-col items-center justify-center text-center min-h-[180px]">
                <div className="w-14 h-14 rounded-xl bg-orange-500/20 flex items-center justify-center mb-4 group-hover:bg-orange-500/30 transition-colors">
                  <CheckSquare className="w-7 h-7 text-orange-500" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Check Script Compliance
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Flow 3 — Ensure your scripts meet platform guidelines
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>

      {/* Recent Videos */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Recent Videos
          </h2>
          {videoStats.recent.length > 0 && (
            <Link
              href="/dashboard/library"
              className="text-sm font-medium text-orange-500 hover:text-orange-400 flex items-center gap-1"
            >
              View all
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
        {videoStats.recent.length > 0 ? (
          <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
            <CardContent className="p-0">
              <ul className="divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A]">
                {videoStats.recent.map((item) => {
                  const badgeLabel = item.source === "tiktok-shop" ? "TikTok Shop" : "Digital Product";
                  return (
                    <li key={`${item.source}-${item.id}`}>
                      <Link
                        href={item.href}
                        className="flex items-center gap-3 px-6 py-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
                          <Video className="w-5 h-5 text-orange-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-gray-900 dark:text-white truncate">
                              {item.title}
                            </p>
                            <span
                              className={`shrink-0 inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                                item.source === "tiktok-shop"
                                  ? "bg-gray-200 dark:bg-[#2A2A2A] text-gray-700 dark:text-gray-300"
                                  : "bg-orange-500/20 text-orange-600 dark:text-orange-300"
                              }`}
                            >
                              {badgeLabel}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {item.createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-500 shrink-0" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] border-dashed bg-white dark:bg-[#1A1A1A]">
            <CardContent className="p-12 flex flex-col items-center justify-center text-center min-h-[200px]">
              <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-[#2A2A2A] flex items-center justify-center mb-4">
                <Video className="w-8 h-8 text-gray-500" />
              </div>
              <p className="text-gray-700 dark:text-gray-400 mb-2 font-medium">
                No videos yet. Create your first video to get started!
              </p>
              <p className="text-sm text-gray-500 mb-6">
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
        )}
      </section>
    </main>
  );
}
