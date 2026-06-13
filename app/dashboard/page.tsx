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
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq, desc, isNull, and, count, gte, sql } from "drizzle-orm";
import { productOrdersTable } from "@/db/schema/product-orders-schema";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { brandProfilesTable } from "@/db/schema/brand-profiles-schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Package, Video, Play, ExternalLink, AlertCircle,
  ArrowRight, TrendingUp, Mail, Target, Film, Calendar, Rocket,
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
import { FirstTaskBanner } from "@/components/dashboard/FirstTaskBanner";

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

async function getActualRevenue(userId: string): Promise<{ totalCents: number; totalOrders: number }> {
  try {
    const [row] = await db
      .select({
        totalCents: sql<number>`COALESCE(SUM(${productOrdersTable.amountCents}), 0)`,
        totalOrders: sql<number>`COUNT(*)`,
      })
      .from(productOrdersTable)
      .where(and(eq(productOrdersTable.creatorUserId, userId), eq(productOrdersTable.status, "completed")));
    return { totalCents: Number(row?.totalCents ?? 0), totalOrders: Number(row?.totalOrders ?? 0) };
  } catch {
    return { totalCents: 0, totalOrders: 0 };
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
    const [bvRow, bpRow, products] = await Promise.all([
      db.select({ id: brandVoiceTable.id, brandName: brandVoiceTable.brandName })
        .from(brandVoiceTable)
        .where(eq(brandVoiceTable.userId, userId))
        .limit(1),
      db.select({ brandName: brandProfilesTable.brandName })
        .from(brandProfilesTable)
        .where(eq(brandProfilesTable.userId, userId))
        .limit(1),
      db.select({ marketingAssets: productsTable.marketingAssets })
        .from(productsTable)
        .where(and(eq(productsTable.userId, userId), isNull(productsTable.deletedAt)))
        .limit(20),
    ]);

    const hasBrandVoice = !!(bvRow[0]?.brandName?.trim()) || !!(bpRow[0]?.brandName?.trim());
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
      className={`group relative rounded-2xl p-4 sm:p-5 border transition-all hover:shadow-md ${
        accent
          ? "bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/10 border-orange-200 dark:border-orange-900/40"
          : "bg-white dark:bg-[#1A1A1A] border-gray-100 dark:border-[#2A2A2A] hover:border-gray-200 dark:hover:border-[#3A3A3A]"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${iconColor}`} />
        </div>
        {href && (
          <span className="text-xs text-gray-400 dark:text-gray-600 group-hover:text-gray-600 dark:group-hover:text-gray-400 transition-colors font-medium">
            View →
          </span>
        )}
      </div>
      <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-0.5">
        {value}
      </p>
      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">{label}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-600 mt-1 hidden sm:block">{sub}</p>}
      {cta && (
        <span className="inline-block mt-2 sm:mt-3 text-xs font-semibold text-orange-500 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
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

// ─── Journey action card ──────────────────────────────────────────────────────
function JourneyCard({
  href,
  icon: Icon,
  step,
  label,
  description,
  cta,
  highlight,
  accent,
}: {
  href: string;
  icon: React.ElementType;
  step: string;
  label: string;
  description: string;
  cta: string;
  highlight?: boolean;
  accent?: string;
}) {
  return (
    <Link href={href} className="block h-full">
      <div className={`group h-full rounded-2xl border transition-all hover:shadow-lg p-5 sm:p-6 flex flex-col ${
        highlight
          ? "bg-gradient-to-br from-orange-500 to-amber-500 border-orange-400 text-white shadow-md shadow-orange-500/20"
          : "bg-white dark:bg-[#1A1A1A] border-gray-100 dark:border-[#2A2A2A] hover:border-orange-300/60 dark:hover:border-orange-500/30"
      }`}>
        <div className="flex items-start justify-between mb-4">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
            highlight ? "bg-white/20" : (accent ?? "bg-orange-50 dark:bg-orange-950/30")
          }`}>
            <Icon className={`w-5 h-5 ${highlight ? "text-white" : "text-orange-500"}`} />
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-widest ${
            highlight ? "text-white/60" : "text-gray-400 dark:text-gray-600"
          }`}>{step}</span>
        </div>
        <h3 className={`font-bold text-base mb-1.5 ${highlight ? "text-white" : "text-gray-900 dark:text-white"}`}>
          {label}
        </h3>
        <p className={`text-sm leading-relaxed flex-1 ${highlight ? "text-white/80" : "text-gray-500 dark:text-gray-400"}`}>
          {description}
        </p>
        <div className={`mt-4 flex items-center gap-1 text-sm font-semibold ${
          highlight ? "text-white" : "text-orange-500 group-hover:text-orange-600"
        }`}>
          {cta} <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}

// ─── Smart next-action banner ─────────────────────────────────────────────────
function NextActionBanner({
  productsCount,
  videosCount,
  totalOrders,
}: {
  productsCount: number;
  videosCount: number;
  totalOrders: number;
}) {
  let icon = Package;
  let href = "/dashboard/digital-products/create";
  let title = "Create your first digital product";
  let desc = "Describe your idea and AI writes a complete ebook, planner, or guide in minutes — ready to sell.";
  let cta = "Create Product";
  let step = "Step 1 of 4";

  if (productsCount > 0 && videosCount === 0) {
    icon = Video;
    href = "/dashboard/digital-products";
    title = "Create a promo video for your product";
    desc = "You have products — now turn them into short videos that drive traffic and sales on social media.";
    cta = "Create Video";
    step = "Step 2 of 4";
  } else if (productsCount > 0 && videosCount > 0 && totalOrders === 0) {
    icon = Calendar;
    href = "/dashboard/content-calendar";
    title = "Plan your content to drive sales";
    desc = "You have products and videos — now schedule your posts consistently to build momentum and get your first sale.";
    cta = "Plan Content";
    step = "Step 3 of 4";
  } else if (productsCount > 0 && videosCount > 0 && totalOrders > 0) {
    icon = Rocket;
    href = "/dashboard/digital-products";
    title = "Keep the flywheel spinning";
    desc = "Great work — you have products, videos, and sales. Create your next product to grow your catalogue.";
    cta = "Launch Next Product";
    step = "Step 4 of 4";
  }

  const Icon = icon;
  return (
    <div className="mb-6 sm:mb-8 rounded-2xl border border-orange-200 dark:border-orange-500/20 bg-orange-50 dark:bg-orange-950/10 p-5 flex items-start gap-4">
      <div className="w-10 h-10 shrink-0 rounded-xl bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center">
        <Icon className="w-5 h-5 text-orange-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-orange-400">{step} — Next Action</span>
        </div>
        <p className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">{title}</p>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{desc}</p>
      </div>
      <Link
        href={href}
        className="shrink-0 inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-400 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap"
      >
        {cta} <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function DashboardPage() {
  const { userId } = await auth();
  const [videoStats, incompleteProducts, checklist, videosThisWeek, emailSubscribers, activeGoals, campaignsSent, profileRow, revenue] = userId
    ? await Promise.all([
        getVideoStats(userId),
        getIncompleteProducts(userId),
        getChecklistData(userId),
        getVideosThisWeek(userId),
        getEmailSubscriberCount(userId),
        getActiveGoalsCount(userId),
        getCampaignsSentCount(userId),
        db.select({ videoCredits: profilesTable.videoCredits }).from(profilesTable).where(eq(profilesTable.userId, userId)).limit(1).then(r => r[0] ?? null).catch(() => null),
        getActualRevenue(userId),
      ])
    : [
        { digitalProductsCount: 0, tiktokShopCount: 0, totalLibraryVideos: 0, recent: [] as RecentVideoItem[] },
        [] as IncompleteProduct[],
        { hasBrandVoice: false, hasProduct: false, hasThumbnail: false, hasPromoVideo: false },
        0, 0, 0, 0, null, { totalCents: 0, totalOrders: 0 },
      ];

  const videoCredits = (profileRow as { videoCredits?: number | null } | null)?.videoCredits ?? 0;
  const { totalCents, totalOrders } = revenue as { totalCents: number; totalOrders: number };
  const revenueLabel = totalCents > 0 ? `£${(totalCents / 100).toFixed(2)}` : "£0.00";

  const hasSubscriber = emailSubscribers > 0;
  const hasCampaign = campaignsSent > 0;
  const showChecklist =
    !checklist.hasBrandVoice || !checklist.hasProduct || !checklist.hasThumbnail ||
    !checklist.hasPromoVideo || !hasSubscriber || !hasCampaign;

  const estimatedRevenue = videoStats.digitalProductsCount * 15;

  return (
    <main className="p-4 sm:p-6 md:p-10 max-w-[1280px] mx-auto">
      <Suspense fallback={null}><ReferralCapture /></Suspense>
      <Suspense fallback={null}><InviteCapture /></Suspense>
      <SyncOnboardingSteps digitalProductsCount={videoStats.digitalProductsCount} />

      {/* Hero */}
      <DashboardHero
        productsCount={videoStats.digitalProductsCount}
        videosCount={videoStats.totalLibraryVideos}
        videosThisWeek={videosThisWeek}
        emailSubscribers={emailSubscribers}
      />

      {/* Smart Next Action */}
      <NextActionBanner
        productsCount={videoStats.digitalProductsCount}
        videosCount={videoStats.totalLibraryVideos}
        totalOrders={totalOrders}
      />

      {/* First task banner — shown to new users with no products yet */}
      <FirstTaskBanner hasProduct={videoStats.digitalProductsCount > 0} />

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
      <section className="mb-8 sm:mb-10" data-tour="quick-stats">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">Overview</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Video Credits"
            value={videoCredits}
            sub={videoCredits === 0 ? "Buy credits to generate videos" : `${videoCredits} video${videoCredits !== 1 ? "s" : ""} ready to generate`}
            icon={Film}
            iconBg="bg-orange-50 dark:bg-orange-950/30"
            iconColor="text-orange-500"
            href="/dashboard/video-credits"
            cta={videoCredits === 0 ? "Buy credits" : undefined}
            accent={videoCredits > 0}
          />
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
            label="Store Revenue"
            value={revenueLabel}
            sub={totalOrders > 0 ? `${totalOrders} order${totalOrders !== 1 ? "s" : ""} completed` : "Make your first sale"}
            icon={TrendingUp}
            iconBg="bg-orange-50 dark:bg-orange-950/30"
            iconColor="text-orange-500"
            href="/dashboard/orders"
            accent={totalOrders > 0}
            cta={totalOrders === 0 ? "Set up store" : "View orders"}
          />
        </div>
      </section>

      {/* Analytics Widget */}
      <AnalyticsWidget />

      {/* Finish to Sell */}
      {incompleteProducts.length > 0 && (
        <section className="mb-8 sm:mb-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center">
                <AlertCircle className="w-4 h-4 text-amber-500" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
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

      {/* Journey Cards */}
      <section className="mb-8 sm:mb-10" data-tour="quick-actions">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">Your Journey</h2>
          <span className="text-xs text-gray-400 dark:text-gray-600 font-medium">Idea → Product → Content → Sales</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <JourneyCard
            href="/dashboard/digital-products/create"
            icon={Package}
            step="Step 1"
            label="Create Product"
            description="Generate ebooks, guides, planners, and templates in minutes. Describe your idea — AI does the rest."
            cta="Create now"
            highlight={videoStats.digitalProductsCount === 0}
            accent="bg-blue-50 dark:bg-blue-950/30"
          />
          <JourneyCard
            href="/dashboard/digital-products"
            icon={Video}
            step="Step 2"
            label="Create Video"
            description="Turn your product into promo videos and captions for TikTok, Instagram, and YouTube."
            cta="Create video"
            highlight={videoStats.digitalProductsCount > 0 && videoStats.totalLibraryVideos === 0}
            accent="bg-orange-50 dark:bg-orange-950/30"
          />
          <JourneyCard
            href="/dashboard/content-calendar"
            icon={Calendar}
            step="Step 3"
            label="Plan Content"
            description="Schedule your posts, stay consistent, and build the momentum that drives consistent sales."
            cta="Plan posts"
            highlight={videoStats.digitalProductsCount > 0 && videoStats.totalLibraryVideos > 0 && totalOrders === 0}
            accent="bg-violet-50 dark:bg-violet-950/30"
          />
          <JourneyCard
            href="/dashboard/store"
            icon={Rocket}
            step="Step 4"
            label="Launch & Sell"
            description="Your store is built in. Set a price, go live, and start collecting payments through Stripe."
            cta="View store"
            highlight={videoStats.digitalProductsCount > 0 && videoStats.totalLibraryVideos > 0 && totalOrders > 0}
            accent="bg-emerald-50 dark:bg-emerald-950/30"
          />
        </div>
      </section>

      {/* What's Working */}
      <WhatsWorkingSection />

      {/* Recent Videos */}
      <section className="mt-8 sm:mt-10" data-tour="recent-videos">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
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
                      className="flex items-center gap-3 px-4 sm:px-6 py-3 sm:py-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
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
            <div className="p-8 sm:p-12 flex flex-col items-center justify-center text-center">
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
