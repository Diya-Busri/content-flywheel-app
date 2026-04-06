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
import { eq, desc, isNull, and, count, gte } from "drizzle-orm";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, ShoppingBag, CheckSquare, Video, Play, ExternalLink, AlertCircle, ArrowRight, Package2, TrendingUp } from "lucide-react";
import { SyncOnboardingSteps } from "@/components/onboarding/sync-onboarding-steps";
import { GettingStartedChecklist } from "@/components/dashboard/GettingStartedChecklist";
import { AnalyticsWidget } from "@/components/dashboard/AnalyticsWidget";
import { WhatsWorkingSection } from "@/components/dashboard/WhatsWorkingSection";
import { FirstVideoNudge } from "@/components/dashboard/FirstVideoNudge";
import { MotivationBanner } from "@/components/dashboard/MotivationBanner";
import { NextActionStrip } from "@/components/dashboard/NextActionStrip";
import { ConsistencyStreak } from "@/components/dashboard/ConsistencyStreak";

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

type IncompleteProduct = {
  id: string;
  title: string;
  completionScore: number;
  missingStep: string;
  missingTab: string;
};

function computeProductCompletion(ma: Record<string, unknown> | null, status: string) {
  const hasContent = status === "draft" || status === "complete";
  const hasThumbnail = !!(ma?.thumbnailUrl || ma?.coverThumbnailUrl);
  const hasBookMockup = !!(ma?.bookMockupUrl);
  const hasMarketingAssets = !!(
    ma?.productTitle && typeof ma.productTitle === "string" && ma.productTitle.trim() &&
    ma?.productDescription && typeof ma.productDescription === "string" && ma.productDescription.trim()
  );
  const hasPromoVideo = !!(ma?.promoVideoUrl && ma?.promoVideoStatus === "completed");

  const score =
    (hasContent ? 20 : 0) +
    (hasThumbnail ? 20 : 0) +
    (hasBookMockup ? 20 : 0) +
    (hasMarketingAssets ? 20 : 0) +
    (hasPromoVideo ? 20 : 0);

  let missingStep = "";
  let missingTab = "marketing";
  if (!hasContent) { missingStep = "Generate content"; missingTab = "content"; }
  else if (!hasThumbnail) { missingStep = "Add a cover thumbnail"; missingTab = "marketing"; }
  else if (!hasBookMockup) { missingStep = "Create a book mockup"; missingTab = "marketing"; }
  else if (!hasMarketingAssets) { missingStep = "Generate marketing copy"; missingTab = "marketing"; }
  else if (!hasPromoVideo) { missingStep = "Record a promo video"; missingTab = "videos"; }

  return { score, missingStep, missingTab };
}

type ChecklistData = {
  hasBrandVoice: boolean;
  hasProduct: boolean;
  hasThumbnail: boolean;
  hasPromoVideo: boolean;
};

async function getVideosThisWeek(userId: string): Promise<number> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  try {
    const result = await db
      .select({ count: count() })
      .from(videosTable)
      .where(and(eq(videosTable.userId, userId), isNull(videosTable.deletedAt), gte(videosTable.createdAt, sevenDaysAgo)));
    return Number(result[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

async function getChecklistData(userId: string): Promise<ChecklistData> {
  try {
    const [bvRow, products] = await Promise.all([
      db.select({ id: brandVoiceTable.id, brandName: brandVoiceTable.brandName })
        .from(brandVoiceTable)
        .where(eq(brandVoiceTable.userId, userId))
        .limit(1),
      db.select({ marketingAssets: productsTable.marketingAssets })
        .from(productsTable)
        .where(and(eq(productsTable.userId, userId), isNull(productsTable.deletedAt)))
        .limit(20),
    ]);

    const hasBrandVoice = !!(bvRow[0]?.brandName?.trim());
    const hasProduct = products.length > 0;
    let hasThumbnail = false;
    let hasPromoVideo = false;

    for (const p of products) {
      const ma = (p.marketingAssets ?? {}) as Record<string, unknown>;
      if (ma.thumbnailUrl || ma.coverThumbnailUrl) hasThumbnail = true;
      if (ma.promoVideoUrl && ma.promoVideoStatus === "completed") hasPromoVideo = true;
      if (hasThumbnail && hasPromoVideo) break;
    }

    return { hasBrandVoice, hasProduct, hasThumbnail, hasPromoVideo };
  } catch (err) {
    console.error("[dashboard] getChecklistData:", err);
    return { hasBrandVoice: false, hasProduct: false, hasThumbnail: false, hasPromoVideo: false };
  }
}

async function getIncompleteProducts(userId: string): Promise<IncompleteProduct[]> {
  try {
    const rows = await db
      .select({ id: productsTable.id, title: productsTable.title, status: productsTable.status, marketingAssets: productsTable.marketingAssets })
      .from(productsTable)
      .where(and(eq(productsTable.userId, userId), isNull(productsTable.deletedAt)))
      .orderBy(desc(productsTable.createdAt))
      .limit(20);

    const incomplete: IncompleteProduct[] = [];
    for (const row of rows) {
      const ma = (row.marketingAssets ?? {}) as Record<string, unknown>;
      const { score, missingStep, missingTab } = computeProductCompletion(ma, row.status ?? "");
      if (score < 100) {
        incomplete.push({
          id: row.id,
          title: (row.title as string | null) || "Untitled product",
          completionScore: score,
          missingStep,
          missingTab,
        });
      }
    }
    return incomplete.slice(0, 4);
  } catch (err) {
    console.error("[dashboard] getIncompleteProducts:", err);
    return [];
  }
}

async function getVideoStats(userId: string) {
  let tiktokCount = 0;
  let productsCount = 0;
  let totalLibraryVideos = 0;
  const recent: RecentVideoItem[] = [];

  // Products count
  const productWhere = and(eq(productsTable.userId, userId), isNull(productsTable.deletedAt));
  try {
    const productsCountRow = await db
      .select({ count: count() })
      .from(productsTable)
      .where(productWhere);
    const raw = productsCountRow[0]?.count;
    productsCount = typeof raw === "bigint" ? Number(raw) : Number(raw ?? 0);
  } catch (err) {
    console.error("[dashboard] products count:", err);
  }

  try {
    const videoWhere = and(eq(videosTable.userId, userId), isNull(videosTable.deletedAt));
    const [libraryVideos, ugcJobs, tiktokVideos, tiktokCountRow, libraryVideosCountRow] = await Promise.all([
      db.select({ id: videosTable.id, title: videosTable.title, createdAt: videosTable.createdAt }).from(videosTable).where(videoWhere).orderBy(desc(videosTable.createdAt)).limit(5),
      db.select({ id: videoJobsTable.id, hookPreview: videoJobsTable.hookPreview, createdAt: videoJobsTable.createdAt }).from(videoJobsTable).where(eq(videoJobsTable.userId, userId)).orderBy(desc(videoJobsTable.createdAt)).limit(5),
      db.select({ id: tiktokShopVideosTable.id, productLink: tiktokShopVideosTable.productLink, createdAt: tiktokShopVideosTable.createdAt }).from(tiktokShopVideosTable).where(eq(tiktokShopVideosTable.userId, userId)).orderBy(desc(tiktokShopVideosTable.createdAt)).limit(5),
      db.select({ count: count() }).from(tiktokShopVideosTable).where(eq(tiktokShopVideosTable.userId, userId)),
      db.select({ count: count() }).from(videosTable).where(videoWhere),
    ]);

    tiktokCount = Number(tiktokCountRow[0]?.count ?? 0);
    totalLibraryVideos = Number(libraryVideosCountRow[0]?.count ?? 0);

    const withSource: RecentVideoItem[] = [
      ...libraryVideos.map((v) => ({ id: v.id, title: v.title || "Untitled video", createdAt: v.createdAt!, href: "/dashboard/library", source: "library" as const })),
      ...ugcJobs.map((j) => ({ id: j.id, title: (j.hookPreview || "UGC video").slice(0, 60) + (j.hookPreview && j.hookPreview.length > 60 ? "…" : ""), createdAt: j.createdAt!, href: "/dashboard/ugc-lab", source: "ugc-lab" as const })),
      ...tiktokVideos.map((v) => ({ id: v.id, title: (v.productLink || "TikTok Shop video").slice(0, 60) + (v.productLink && v.productLink.length > 60 ? "…" : ""), createdAt: v.createdAt!, href: "/dashboard/tiktok-shop", source: "tiktok-shop" as const })),
    ];
    recent.push(...withSource.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 5));
  } catch (err) {
    console.error("[dashboard] getVideoStats:", err);
  }

  return { digitalProductsCount: productsCount, tiktokShopCount: tiktokCount, totalLibraryVideos, recent };
}

export default async function DashboardPage() {
  const { userId } = auth();
  const [videoStats, incompleteProducts, checklist, videosThisWeek] = userId
    ? await Promise.all([getVideoStats(userId), getIncompleteProducts(userId), getChecklistData(userId), getVideosThisWeek(userId)])
    : [
        { digitalProductsCount: 0, tiktokShopCount: 0, totalLibraryVideos: 0, recent: [] as RecentVideoItem[] },
        [] as IncompleteProduct[],
        { hasBrandVoice: false, hasProduct: false, hasThumbnail: false, hasPromoVideo: false },
        0,
      ];

  // Only show checklist if at least one step is not done yet
  const showChecklist = !checklist.hasBrandVoice || !checklist.hasProduct || !checklist.hasThumbnail || !checklist.hasPromoVideo;

  return (
    <main className="p-6 md:p-10">
      <SyncOnboardingSteps digitalProductsCount={videoStats.digitalProductsCount} />

      {/* Motivation Banner */}
      <MotivationBanner
        productsCount={videoStats.digitalProductsCount}
        videosCount={videoStats.totalLibraryVideos}
      />

      {/* Next Action Strip */}
      <NextActionStrip
        productsCount={videoStats.digitalProductsCount}
        videosCount={videoStats.totalLibraryVideos}
      />

      {/* Consistency Streak */}
      <ConsistencyStreak videosThisWeek={videosThisWeek} />

      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        Welcome back
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-10">
        Create digital products, generate promo videos, and grow your passive income
      </p>

      {/* First Video Nudge — only shown when totalVideos === 0 and not dismissed */}
      <FirstVideoNudge totalVideos={videoStats.totalLibraryVideos} />

      {/* Getting Started Checklist */}
      {showChecklist && (
        <GettingStartedChecklist
          hasBrandVoice={checklist.hasBrandVoice}
          hasProduct={checklist.hasProduct}
          hasThumbnail={checklist.hasThumbnail}
          hasPromoVideo={checklist.hasPromoVideo}
        />
      )}

      {/* Quick Stats */}
      <section className="mb-12" data-tour="quick-stats">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Quick Stats
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                {videoStats.digitalProductsCount === 1 ? "product created" : "products created"}
              </p>
            </CardContent>
          </Card>
          <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] hover:border-gray-300 dark:hover:border-[#3A3A3A] transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                TikTok Shop Videos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {videoStats.tiktokShopCount}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {videoStats.tiktokShopCount === 1 ? "video generated" : "videos generated"}
              </p>
            </CardContent>
          </Card>

          {/* Revenue & Potential */}
          <Card className="border-orange-200 dark:border-orange-900/40 bg-orange-50/60 dark:bg-orange-950/10 hover:border-orange-300 dark:hover:border-orange-800/60 transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-400 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                Revenue &amp; Potential
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                £{videoStats.digitalProductsCount * 15}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Estimated potential
              </p>
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                {videoStats.digitalProductsCount > 0
                  ? `Based on ${videoStats.digitalProductsCount} product${videoStats.digitalProductsCount > 1 ? "s" : ""} × avg £15 per sale`
                  : "Create your first product to unlock earning potential"}
              </p>
              {videoStats.digitalProductsCount > 0 && (
                <div className="mt-3 space-y-0.5">
                  <p className="text-xs text-gray-500 dark:text-gray-400">1 sale today = <span className="font-semibold text-gray-700 dark:text-gray-300">£15</span></p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">3 sales this week = <span className="font-semibold text-gray-700 dark:text-gray-300">£45</span></p>
                </div>
              )}
              <Link
                href="/dashboard/digital-products"
                className="inline-block mt-3 text-xs font-medium text-orange-500 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
              >
                Get your first sale →
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Analytics Widget — client component, fetches /api/dashboard/stats */}
      <AnalyticsWidget />

      {/* Finish to Sell */}
      {incompleteProducts.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Finish to Sell
              </h2>
            </div>
            <Link
              href="/dashboard/digital-products"
              className="text-sm font-medium text-orange-500 hover:text-orange-400 flex items-center gap-1"
            >
              View all
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {incompleteProducts.map((product) => (
              <Link
                key={product.id}
                href={`/dashboard/digital-products/${product.id}/edit?tab=${product.missingTab}`}
                className="group block"
              >
                <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] hover:border-amber-400/60 dark:hover:border-amber-500/40 transition-all">
                  <CardContent className="p-4 flex items-center gap-4">
                    {/* Completion ring */}
                    <div className="relative shrink-0 w-12 h-12">
                      <svg viewBox="0 0 44 44" className="w-12 h-12 -rotate-90">
                        <circle cx="22" cy="22" r="18" fill="none" stroke="#e5e7eb" strokeWidth="4" className="dark:stroke-gray-700" />
                        <circle
                          cx="22" cy="22" r="18" fill="none"
                          stroke={product.completionScore >= 80 ? "#22c55e" : product.completionScore >= 40 ? "#f59e0b" : "#f97316"}
                          strokeWidth="4"
                          strokeDasharray={`${(product.completionScore / 100) * 2 * Math.PI * 18} ${2 * Math.PI * 18}`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700 dark:text-gray-300 rotate-0">
                        {product.completionScore}%
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 dark:text-white truncate text-sm">
                        {product.title}
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1">
                        <span>Next:</span>
                        <span className="font-medium">{product.missingStep}</span>
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-orange-500 transition-colors shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Quick Actions */}
      <section className="mb-12" data-tour="quick-actions">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          <Link href="/dashboard/digital-products/create">
            <Card className="group cursor-pointer border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] hover:border-orange-500/50 transition-all overflow-hidden h-full">
              <CardContent className="p-8 flex flex-col items-center justify-center text-center min-h-[180px]">
                <div className="w-14 h-14 rounded-xl bg-orange-500/20 flex items-center justify-center mb-4 group-hover:bg-orange-500/30 transition-colors">
                  <Package className="w-7 h-7 text-orange-500" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Create a Digital Product
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Flow 1 — Turn your knowledge into a sellable digital product
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
          <Link href="/dashboard/digital-products/bundle">
            <Card className="group cursor-pointer border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] hover:border-orange-500/50 transition-all overflow-hidden h-full">
              <CardContent className="p-8 flex flex-col items-center justify-center text-center min-h-[180px]">
                <div className="w-14 h-14 rounded-xl bg-orange-500/20 flex items-center justify-center mb-4 group-hover:bg-orange-500/30 transition-colors">
                  <Package2 className="w-7 h-7 text-orange-500" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Create Bundle
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Package existing products into a bundle with AI copy &amp; pricing
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>

      {/* What's Working — hardcoded trending formats */}
      <WhatsWorkingSection />

      {/* Recent Videos */}
      <section data-tour="recent-videos">
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
                <Link href="/dashboard/digital-products/create" className="gap-2">
                  <Play className="w-4 h-4" />
                  Create Product
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </section>
    </main>
  );
}
