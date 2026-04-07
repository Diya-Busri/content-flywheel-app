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
import { emailContactsTable, emailCampaignsTable } from "@/db/schema/email-marketing-schema";
import { goalsTable } from "@/db/schema/goals-schema";
import { eq, desc, isNull, and, count, gte } from "drizzle-orm";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Package, ShoppingBag, CheckSquare, Video, Play, ExternalLink, AlertCircle,
  ArrowRight, Package2, TrendingUp, Mail, Target, Send, BarChart2,
} from "lucide-react";
import { SyncOnboardingSteps } from "@/components/onboarding/sync-onboarding-steps";
import { ReferralCapture } from "@/components/ReferralCapture";
import { InviteCapture } from "@/components/InviteCapture";
import { Suspense } from "react";
import { GettingStartedChecklist } from "@/components/dashboard/GettingStartedChecklist";
import { AnalyticsWidget } from "@/components/dashboard/AnalyticsWidget";
import { WhatsWorkingSection } from "@/components/dashboard/WhatsWorkingSection";
import { FirstVideoNudge } from "@/components/dashboard/FirstVideoNudge";
import { DashboardHero } from "@/components/dashboard/DashboardHero";

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

async function getActiveGoalsCount(userId: string): Promise<number> {
  try {
    const [row] = await db
      .select({ count: count() })
      .from(goalsTable)
      .where(and(eq(goalsTable.userId, userId), eq(goalsTable.status, "active")));
    return Number(row?.count ?? 0);
  } catch {
    return 0;
  }
}

async function getCampaignsSentCount(userId: string): Promise<number> {
  try {
    const [row] = await db
      .select({ count: count() })
      .from(emailCampaignsTable)
      .where(and(eq(emailCampaignsTable.userId, userId), eq(emailCampaignsTable.status, "sent")));
    return Number(row?.count ?? 0);
  } catch {
    return 0;
  }
}

async function getEmailSubscriberCount(userId: string): Promise<number> {
  try {
    const [row] = await db
      .select({ count: count() })
      .from(emailContactsTable)
      .where(
        and(
          eq(emailContactsTable.userId, userId),
          isNull(emailContactsTable.unsubscribedAt)
        )
      );
    return Number(row?.count ?? 0);
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

// ─── Stat card helper ────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconBg,
  iconColor,
  href,
  cta,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  href?: string;
  /** CTA text shown as a styled hint — card itself is the link */
  cta?: string;
  accent?: boolean;
}) {
  const inner = (
    <div
      className={`group relative rounded-2xl p-5 border transition-all hover:shadow-md ${
        accent
          ? "bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/10 border-orange-200 dark:border-orange-900/40"
          : "bg-white dark:bg-[#1A1A1A] border-gray-100 dark:border-[#2A2A2A] hover:border-gray-200 dark:hover:border-[#3A3A3A]"
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        {href && (
          <span className="text-xs text-gray-400 dark:text-gray-600 group-hover:text-gray-600 dark:group-hover:text-gray-400 transition-colors font-medium">
            View →
          </span>
        )}
      </div>
      <p className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-0.5">
        {value}
      </p>
      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{label}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">{sub}</p>}
      {cta && (
        <span className="inline-block mt-3 text-xs font-semibold text-orange-500 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
          {cta} →
        </span>
      )}
    </div>
  );

  if (href) {
    return <Link href={href} className="block">{inner}</Link>;
  }
  return inner;
}

// ─── Quick action card helper ─────────────────────────────────────────────────
function ActionCard({
  href,
  icon: Icon,
  iconBg,
  iconColor,
  label,
  description,
}: {
  href: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  label: string;
  description: string;
}) {
  return (
    <Link href={href}>
      <div className="group h-full rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] hover:border-gray-300 dark:hover:border-[#3A3A3A] hover:shadow-md transition-all p-6 flex flex-col items-center text-center">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 ${iconBg}`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
        <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-1.5 leading-snug">
          {label}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
          {description}
        </p>
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function DashboardPage() {
  const { userId } = auth();
  const [videoStats, incompleteProducts, checklist, videosThisWeek, emailSubscribers, activeGoals, campaignsSent] = userId
    ? await Promise.all([
        getVideoStats(userId),
        getIncompleteProducts(userId),
        getChecklistData(userId),
        getVideosThisWeek(userId),
        getEmailSubscriberCount(userId),
        getActiveGoalsCount(userId),
        getCampaignsSentCount(userId),
      ])
    : [
        { digitalProductsCount: 0, tiktokShopCount: 0, totalLibraryVideos: 0, recent: [] as RecentVideoItem[] },
        [] as IncompleteProduct[],
        { hasBrandVoice: false, hasProduct: false, hasThumbnail: false, hasPromoVideo: false },
        0, 0, 0, 0,
      ];

  const hasSubscriber = emailSubscribers > 0;
  const hasCampaign = campaignsSent > 0;
  const showChecklist =
    !checklist.hasBrandVoice || !checklist.hasProduct || !checklist.hasThumbnail ||
    !checklist.hasPromoVideo || !hasSubscriber || !hasCampaign;

  const estimatedRevenue = videoStats.digitalProductsCount * 15;

  return (
    <main className="p-6 md:p-10 max-w-[1280px] mx-auto">
      <Suspense fallback={null}><ReferralCapture /></Suspense>
      <Suspense fallback={null}><InviteCapture /></Suspense>
      <SyncOnboardingSteps digitalProductsCount={videoStats.digitalProductsCount} />

      {/* Hero — replaces MotivationBanner + NextActionStrip + ConsistencyStreak + h1 */}
      <DashboardHero
        productsCount={videoStats.digitalProductsCount}
        videosCount={videoStats.totalLibraryVideos}
        videosThisWeek={videosThisWeek}
        emailSubscribers={emailSubscribers}
      />

      {/* First Video Nudge */}
      <FirstVideoNudge totalVideos={videoStats.totalLibraryVideos} />

      {/* Getting Started Checklist */}
      {showChecklist && (
        <GettingStartedChecklist
          hasBrandVoice={checklist.hasBrandVoice}
          hasProduct={checklist.hasProduct}
          hasThumbnail={checklist.hasThumbnail}
          hasPromoVideo={checklist.hasPromoVideo}
          hasSubscriber={hasSubscriber}
          hasCampaign={hasCampaign}
        />
      )}

      {/* Stats grid */}
      <section className="mb-10" data-tour="quick-stats">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Overview</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Digital Products"
            value={videoStats.digitalProductsCount}
            sub={videoStats.digitalProductsCount === 0 ? "None yet" : `${videoStats.tiktokShopCount} TikTok videos`}
            icon={Package}
            iconBg="bg-blue-50 dark:bg-blue-950/30"
            iconColor="text-blue-500"
            href={videoStats.digitalProductsCount === 0 ? "/dashboard/digital-products/create" : "/dashboard/digital-products"}
            cta={videoStats.digitalProductsCount === 0 ? "Create first product" : undefined}
          />
          <StatCard
            label="Email Subscribers"
            value={emailSubscribers}
            sub={emailSubscribers === 0 ? "Grow your list" : `${campaignsSent} campaign${campaignsSent !== 1 ? "s" : ""} sent`}
            icon={Mail}
            iconBg="bg-violet-50 dark:bg-violet-950/30"
            iconColor="text-violet-500"
            href="/dashboard/email-marketing"
            cta={emailSubscribers === 0 ? "Add subscribers" : undefined}
          />
          <StatCard
            label="Active Goals"
            value={activeGoals}
            sub={activeGoals === 0 ? "Set a target" : "goals in progress"}
            icon={Target}
            iconBg="bg-emerald-50 dark:bg-emerald-950/30"
            iconColor="text-emerald-500"
            href="/dashboard/goals"
            cta={activeGoals === 0 ? "Set first goal" : undefined}
          />
          <StatCard
            label="Revenue Potential"
            value={`£${estimatedRevenue}`}
            sub={
              videoStats.digitalProductsCount > 0
                ? `${videoStats.digitalProductsCount} product${videoStats.digitalProductsCount > 1 ? "s" : ""} × avg £15`
                : "Create a product to unlock"
            }
            icon={TrendingUp}
            iconBg="bg-orange-50 dark:bg-orange-950/30"
            iconColor="text-orange-500"
            href="/dashboard/digital-products"
            accent
            cta="See products"
          />
        </div>
      </section>

      {/* Analytics Widget */}
      <AnalyticsWidget />

      {/* Finish to Sell */}
      {incompleteProducts.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center">
                <AlertCircle className="w-4 h-4 text-amber-500" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Finish to Sell
              </h2>
            </div>
            <Link
              href="/dashboard/digital-products"
              className="text-sm font-medium text-orange-500 hover:text-orange-400 flex items-center gap-1 transition-colors"
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
                <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] hover:border-amber-300/60 dark:hover:border-amber-500/40 hover:shadow-md transition-all p-4 flex items-center gap-4">
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
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700 dark:text-gray-300">
                      {product.completionScore}%
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white truncate text-sm">
                      {product.title}
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1">
                      <span>Next:</span>
                      <span className="font-medium">{product.missingStep}</span>
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500 transition-colors shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Quick Actions */}
      <section className="mb-10" data-tour="quick-actions">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ActionCard
            href="/dashboard/digital-products/create"
            icon={Package}
            iconBg="bg-blue-50 dark:bg-blue-950/30"
            iconColor="text-blue-500"
            label="Create Digital Product"
            description="Turn your knowledge into a sellable product"
          />
          <ActionCard
            href="/dashboard/tiktok-shop"
            icon={ShoppingBag}
            iconBg="bg-pink-50 dark:bg-pink-950/30"
            iconColor="text-pink-500"
            label="TikTok Shop Video"
            description="Generate videos optimised for TikTok Shop"
          />
          <ActionCard
            href="/dashboard/email-marketing"
            icon={Send}
            iconBg="bg-violet-50 dark:bg-violet-950/30"
            iconColor="text-violet-500"
            label="Email Campaign"
            description="Draft and send to your subscriber list"
          />
          <ActionCard
            href="/dashboard/digital-products/bundle"
            icon={Package2}
            iconBg="bg-amber-50 dark:bg-amber-950/30"
            iconColor="text-amber-500"
            label="Create Bundle"
            description="Package products with AI pricing & copy"
          />
        </div>
        {/* Secondary actions row */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
          <ActionCard
            href="/dashboard/script-checker"
            icon={CheckSquare}
            iconBg="bg-emerald-50 dark:bg-emerald-950/30"
            iconColor="text-emerald-500"
            label="Script Checker"
            description="Check scripts for platform compliance"
          />
          <ActionCard
            href="/dashboard/goals"
            icon={Target}
            iconBg="bg-orange-50 dark:bg-orange-950/30"
            iconColor="text-orange-500"
            label="Set a Goal"
            description="Track your revenue and content milestones"
          />
          <ActionCard
            href="/dashboard/library"
            icon={BarChart2}
            iconBg="bg-cyan-50 dark:bg-cyan-950/30"
            iconColor="text-cyan-500"
            label="Video Library"
            description="Browse and manage all your generated videos"
          />
        </div>
      </section>

      {/* What's Working */}
      <WhatsWorkingSection />

      {/* Recent Videos */}
      <section className="mt-10" data-tour="recent-videos">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Recent Videos
          </h2>
          {videoStats.recent.length > 0 && (
            <Link
              href="/dashboard/library"
              className="text-sm font-medium text-orange-500 hover:text-orange-400 flex items-center gap-1 transition-colors"
            >
              View all
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
        {videoStats.recent.length > 0 ? (
          <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] overflow-hidden">
            <ul className="divide-y divide-gray-100 dark:divide-[#2A2A2A]">
              {videoStats.recent.map((item) => {
                const badgeLabel = item.source === "tiktok-shop" ? "TikTok Shop" : "Digital Product";
                return (
                  <li key={`${item.source}-${item.id}`}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-3 px-6 py-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/20 flex items-center justify-center shrink-0">
                        <Video className="w-5 h-5 text-orange-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900 dark:text-white truncate text-sm">
                            {item.title}
                          </p>
                          <span
                            className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                              item.source === "tiktok-shop"
                                ? "bg-pink-50 dark:bg-pink-950/20 text-pink-600 dark:text-pink-400"
                                : "bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400"
                            }`}
                          >
                            {badgeLabel}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {item.createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-300 hover:text-orange-500 shrink-0 transition-colors" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-dashed border-gray-200 dark:border-[#2A2A2A]">
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-[#2A2A2A] flex items-center justify-center mb-4">
                <Video className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-800 dark:text-gray-300 mb-1 font-semibold">No videos yet</p>
              <p className="text-sm text-gray-500 mb-6">
                Your generated videos will appear here once you create one.
              </p>
              <Button
                asChild
                className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl gap-2"
              >
                <Link href="/dashboard/digital-products/create">
                  <Play className="w-4 h-4" />
                  Create Product
                </Link>
              </Button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
