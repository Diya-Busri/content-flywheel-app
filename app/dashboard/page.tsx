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
import {
  Package, Video, AlertCircle,
  ArrowRight, Film, Clapperboard,
} from "lucide-react";
import { SyncOnboardingSteps } from "@/components/onboarding/sync-onboarding-steps";
import { ReferralCapture } from "@/components/ReferralCapture";
import { InviteCapture } from "@/components/InviteCapture";
import { Suspense } from "react";
import { TodaysFocus } from "@/components/dashboard/TodaysFocus";

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
  const { totalOrders } = revenue as { totalCents: number; totalOrders: number };

  return (
    <main className="p-4 sm:p-6 md:p-8 max-w-[1200px] mx-auto">
      <Suspense fallback={null}><ReferralCapture /></Suspense>
      <Suspense fallback={null}><InviteCapture /></Suspense>
      <SyncOnboardingSteps digitalProductsCount={videoStats.digitalProductsCount} />

      {/* Today's Focus — single most impactful next action */}
      <TodaysFocus
        productsCount={videoStats.digitalProductsCount}
        videosCount={videoStats.totalLibraryVideos}
        hasThumbnail={checklist.hasThumbnail}
        totalOrders={totalOrders}
        emailSubscribers={emailSubscribers}
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Products", value: videoStats.digitalProductsCount, href: "/dashboard/digital-products", icon: Package, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30", gradient: "from-blue-50 to-blue-50/0 dark:from-blue-950/20 dark:to-transparent" },
          { label: "Library Items", value: videoStats.totalLibraryVideos, href: "/dashboard/library", icon: Film, color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-950/30", gradient: "from-orange-50 to-orange-50/0 dark:from-orange-950/20 dark:to-transparent" },
          { label: "Videos This Week", value: videosThisWeek, href: "/dashboard/library", icon: Clapperboard, color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-950/30", gradient: "from-violet-50 to-violet-50/0 dark:from-violet-950/20 dark:to-transparent" },
          { label: "Video Credits", value: videoCredits, href: "/dashboard/video-credits", icon: Film, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/30", gradient: "from-emerald-50 to-emerald-50/0 dark:from-emerald-950/20 dark:to-transparent" },
        ].map(({ label, value, href, icon: Icon, color, bg, gradient }) => (
          <Link key={label} href={href} className={`group relative overflow-hidden rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] p-4 hover:border-gray-200 dark:hover:border-[#3A3A3A] hover:shadow-sm transition-all`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-60 pointer-events-none`} />
            <div className="relative">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${bg}`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">{label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Incomplete products */}
      {incompleteProducts.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Finish to sell</h2>
            </div>
            <Link href="/dashboard/digital-products" className="text-xs font-medium text-orange-500 hover:text-orange-400 transition-colors">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {incompleteProducts.map((product) => (
              <Link key={product.id} href={`/dashboard/digital-products/${product.id}/edit?tab=${product.missingTab}`} className="group block">
                <div className="rounded-xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] hover:border-amber-300/60 dark:hover:border-amber-500/40 hover:shadow-sm transition-all p-3 flex items-center gap-3">
                  <div className="relative shrink-0 w-10 h-10">
                    <svg viewBox="0 0 44 44" className="w-10 h-10 -rotate-90">
                      <circle cx="22" cy="22" r="18" fill="none" stroke="#e5e7eb" strokeWidth="4" className="dark:stroke-gray-700" />
                      <circle cx="22" cy="22" r="18" fill="none" stroke={product.completionScore >= 80 ? "#22c55e" : product.completionScore >= 40 ? "#f59e0b" : "#f97316"} strokeWidth="4" strokeDasharray={`${(product.completionScore / 100) * 2 * Math.PI * 18} ${2 * Math.PI * 18}`} strokeLinecap="round" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-700 dark:text-gray-300">{product.completionScore}%</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white truncate text-sm">{product.title}</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Next: {product.missingStep}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500 transition-colors shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Quick-launch tools grid */}
      <section className="mb-6">
        <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Your tools</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { href: "/dashboard/ai-coach", emoji: "🤖", label: "AI Coach", desc: "Chat, plan, generate content", style: "highlight" },
            { href: "/dashboard/digital-products", emoji: "📦", label: "Create Product", desc: "AI writes your eBook or guide", style: "blue" },
            { href: "/dashboard/design-studio", emoji: "🎨", label: "Design Studio", desc: "Images, graphics, bulk posts", style: "purple" },
            { href: "/dashboard/video-guide/new", emoji: "🎬", label: "Video Guide", desc: "Script + scenes in 30 sec", style: "rose" },
            { href: "/dashboard/library", emoji: "📚", label: "My Library", desc: "All your saved content", style: "default" },
            { href: "/dashboard/email-marketing", emoji: "📧", label: "Email", desc: "Campaigns + subscriber list", style: "default" },
          ].map(({ href, emoji, label, desc, style }) => (
            <Link key={href} href={href} className="group block">
              <div className={`rounded-2xl border p-4 h-full transition-all hover:shadow-md ${
                style === "highlight"
                  ? "bg-gradient-to-br from-orange-500 to-amber-500 border-orange-400 text-white shadow-sm shadow-orange-500/20"
                  : style === "blue"
                  ? "bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900/40 hover:border-blue-300/60 dark:hover:border-blue-500/30"
                  : style === "purple"
                  ? "bg-violet-50 dark:bg-violet-950/30 border-violet-100 dark:border-violet-900/40 hover:border-violet-300/60 dark:hover:border-violet-500/30"
                  : style === "rose"
                  ? "bg-rose-50 dark:bg-rose-950/30 border-rose-100 dark:border-rose-900/40 hover:border-rose-300/60 dark:hover:border-rose-500/30"
                  : "bg-white dark:bg-[#1A1A1A] border-gray-100 dark:border-[#2A2A2A] hover:border-orange-300/60 dark:hover:border-orange-500/30"
              }`}>
                <div className="text-2xl mb-2">{emoji}</div>
                <p className={`font-bold text-sm mb-0.5 ${style === "highlight" ? "text-white" : "text-gray-900 dark:text-white"}`}>{label}</p>
                <p className={`text-xs leading-relaxed ${style === "highlight" ? "text-white/80" : "text-gray-500 dark:text-gray-400"}`}>{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent library items */}
      {videoStats.recent.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Recent activity</h2>
            <Link href="/dashboard/library" className="text-xs font-medium text-orange-500 hover:text-orange-400 transition-colors">View all →</Link>
          </div>
          <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] overflow-hidden">
            <ul className="divide-y divide-gray-100 dark:divide-[#2A2A2A]">
              {videoStats.recent.map((item) => (
                <li key={`${item.source}-${item.id}`}>
                  <Link href={item.href} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/20 flex items-center justify-center shrink-0">
                      <Video className="w-4 h-4 text-orange-500" />
                    </div>
                    <p className="font-medium text-gray-900 dark:text-white truncate text-sm flex-1">{item.title}</p>
                    <p className="text-xs text-gray-400 shrink-0">{item.createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </main>
  );
}
