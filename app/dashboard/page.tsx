/**
 * Dashboard home page for Content Flywheel
 * Displays quick stats (synced with profile + DB), quick actions, and recent videos
 */
import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { videosTable, tiktokShopVideosTable, scriptsTable } from "@/db/schema/library-schema";
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
    const scriptWhere = and(eq(scriptsTable.userId, userId), isNull(scriptsTable.deletedAt));
    const [libraryVideos, ugcJobs, tiktokVideos, tiktokCountRow, libraryVideosCountRow, scriptsCountRow] = await Promise.all([
      db.select({ id: videosTable.id, title: videosTable.title, createdAt: videosTable.createdAt }).from(videosTable).where(videoWhere).orderBy(desc(videosTable.createdAt)).limit(5),
      db.select({ id: videoJobsTable.id, hookPreview: videoJobsTable.hookPreview, createdAt: videoJobsTable.createdAt }).from(videoJobsTable).where(eq(videoJobsTable.userId, userId)).orderBy(desc(videoJobsTable.createdAt)).limit(5),
      db.select({ id: tiktokShopVideosTable.id, productLink: tiktokShopVideosTable.productLink, createdAt: tiktokShopVideosTable.createdAt }).from(tiktokShopVideosTable).where(eq(tiktokShopVideosTable.userId, userId)).orderBy(desc(tiktokShopVideosTable.createdAt)).limit(5),
      db.select({ count: count() }).from(tiktokShopVideosTable).where(eq(tiktokShopVideosTable.userId, userId)),
      db.select({ count: count() }).from(videosTable).where(videoWhere),
      db.select({ count: count() }).from(scriptsTable).where(scriptWhere),
    ]);

    tiktokCount = Number(tiktokCountRow[0]?.count ?? 0);
    totalLibraryVideos = Number(libraryVideosCountRow[0]?.count ?? 0) + Number(scriptsCountRow[0]?.count ?? 0);

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

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const nudge = videoStats.digitalProductsCount === 0
    ? "Let's create your first product today."
    : videoStats.totalLibraryVideos === 0
    ? `You have ${videoStats.digitalProductsCount} product — time to make your first promo video.`
    : `${videoStats.digitalProductsCount} product${videoStats.digitalProductsCount > 1 ? "s" : ""} · ${videoStats.totalLibraryVideos} library item${videoStats.totalLibraryVideos > 1 ? "s" : ""}. Keep the flywheel spinning.`;

  const tools = [
    { href: "/dashboard/ai-coach",        emoji: "🤖", label: "AI Coach",       desc: "Chat, plan, generate content"  },
    { href: "/dashboard/digital-products", emoji: "📦", label: "Create Product", desc: "AI writes your eBook or guide" },
    { href: "/dashboard/design-studio",   emoji: "🎨", label: "Design Studio",  desc: "Images, graphics, bulk posts"  },
    { href: "/dashboard/video-guide/new", emoji: "🎬", label: "Video Guide",    desc: "Script + scenes in 30 sec"    },
    { href: "/dashboard/library",         emoji: "📚", label: "My Library",     desc: "All your saved content"       },
    { href: "/dashboard/email-marketing", emoji: "📧", label: "Email",          desc: "Campaigns + subscriber list"  },
  ];

  return (
    <main className="min-h-full">
      <Suspense fallback={null}><ReferralCapture /></Suspense>
      <Suspense fallback={null}><InviteCapture /></Suspense>
      <SyncOnboardingSteps digitalProductsCount={videoStats.digitalProductsCount} />

      {/* ── Hero banner ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-rose-500 to-violet-600 px-6 pt-10 pb-16 sm:px-10">
        {/* decorative blobs */}
        <div className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-10 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative max-w-[1200px] mx-auto">
          <p className="text-white/70 text-sm font-medium mb-1 uppercase tracking-widest">Content Flywheel</p>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
            {greeting} 👋
          </h1>
          <p className="text-white/80 mt-2 text-base max-w-lg">{nudge}</p>
        </div>
      </div>

      {/* ── Body (lifted over banner) ────────────────────────────────────────── */}
      <div className="relative -mt-8 max-w-[1200px] mx-auto px-4 sm:px-6 md:px-8 pb-12">

        {/* Stats row — float up over the banner */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Products",        value: videoStats.digitalProductsCount, href: "/dashboard/digital-products", icon: Package,    grad: "from-blue-500 to-indigo-500"  },
            { label: "Library Items",   value: videoStats.totalLibraryVideos,   href: "/dashboard/library",          icon: Film,       grad: "from-orange-500 to-amber-500" },
            { label: "Videos This Week",value: videosThisWeek,                  href: "/dashboard/library",          icon: Clapperboard, grad: "from-violet-500 to-purple-600" },
            { label: "Video Credits",   value: videoCredits,                    href: "/dashboard/video-credits",    icon: Film,       grad: "from-emerald-500 to-teal-500" },
          ].map(({ label, value, href, icon: Icon, grad }) => (
            <Link key={label} href={href} className="group">
              <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] shadow-lg p-4 hover:shadow-xl hover:-translate-y-1 transition-all duration-150">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center mb-3 shadow-sm`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <p className="text-3xl font-black text-gray-900 dark:text-white leading-none tabular-nums">{value.toLocaleString()}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-1.5">{label}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Today's Focus */}
        <TodaysFocus
          productsCount={videoStats.digitalProductsCount}
          videosCount={videoStats.totalLibraryVideos}
          hasThumbnail={checklist.hasThumbnail}
          totalOrders={totalOrders}
          emailSubscribers={emailSubscribers}
        />

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
                  <div className="rounded-xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] hover:border-amber-300 dark:hover:border-amber-500/50 hover:shadow-md transition-all p-3 flex items-center gap-3">
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

        {/* Tools grid */}
        <section className="mb-6">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3 uppercase tracking-wide">Your tools</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {tools.map(({ href, emoji, label, desc }) => (
              <Link key={href} href={href} className="group">
                <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] p-5 h-full shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-orange-200 dark:hover:border-orange-500/30 transition-all duration-150">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center mb-3 text-xl group-hover:bg-orange-500/20 transition-colors">{emoji}</div>
                  <p className="font-bold text-gray-900 dark:text-white text-sm mb-1">{label}</p>
                  <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed">{desc}</p>
                  <ArrowRight className="absolute bottom-4 right-4 w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Recent activity */}
        {videoStats.recent.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide">Recent activity</h2>
              <Link href="/dashboard/library" className="text-xs font-medium text-orange-500 hover:text-orange-400 transition-colors">View all →</Link>
            </div>
            <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] shadow-sm overflow-hidden">
              <ul className="divide-y divide-gray-100 dark:divide-[#2A2A2A]">
                {videoStats.recent.map((item) => (
                  <li key={`${item.source}-${item.id}`}>
                    <Link href={item.href} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center shrink-0 shadow-sm">
                        <Video className="w-4 h-4 text-white" />
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
      </div>
    </main>
  );
}
