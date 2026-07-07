/**
 * Dashboard home — stage-aware layout
 *
 * Stage 0 (new user, no products):
 *   Launch-mode hero → checklist front + centre → quick-start tools → stats (de-emphasised)
 *
 * Stage 1 (has products, no sales):
 *   Metrics hero → stats → incomplete products → checklist → tools
 *
 * Stage 2 (active, has sales):
 *   Metrics hero → stats → today activity → incomplete products → tools → recent
 */
import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { videosTable, tiktokShopVideosTable, scriptsTable } from "@/db/schema/library-schema";
import { videoJobsTable } from "@/db/schema/video-jobs-schema";
import { productsTable } from "@/db/schema/products-schema";
import { emailContactsTable } from "@/db/schema/email-marketing-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { storeSettingsTable } from "@/db/schema/store-settings-schema";
import { eq, desc, isNull, and, count, gte, sql } from "drizzle-orm";
import { productOrdersTable } from "@/db/schema/product-orders-schema";
import {
  Package, Video, AlertCircle, ArrowRight,
  Users, ShoppingBag, PoundSterling, Sparkles,
  Search, Rocket, ChevronRight,
} from "lucide-react";
import { SyncOnboardingSteps } from "@/components/onboarding/sync-onboarding-steps";
import { ReferralCapture } from "@/components/ReferralCapture";
import { InviteCapture } from "@/components/InviteCapture";
import { Suspense } from "react";
import { ContinueLearningCard } from "@/components/dashboard/ContinueLearningCard";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";
import { ShareStoreBar } from "@/components/dashboard/ShareStoreBar";
import { ProjectsSection } from "@/components/dashboard/ProjectsSection";

export const metadata: Metadata = {
  title: "Dashboard | Content Flywheel",
  description: "Create, sell and market digital products with AI",
};

// ─── Types ─────────────────────────────────────────────────────────────────────

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

// ─── Helpers ───────────────────────────────────────────────────────────────────

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
  else if (!hasThumbnail) { missingStep = "Add a cover image"; missingTab = "marketing"; }
  else if (!hasBookMockup) { missingStep = "Create a book mockup"; missingTab = "marketing"; }
  else if (!hasMarketingAssets) { missingStep = "Generate marketing copy"; missingTab = "marketing"; }
  else if (!hasPromoVideo) { missingStep = "Record a promo video"; missingTab = "videos"; }

  return { score, missingStep, missingTab };
}

async function getActiveStoreUrl(userId: string): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://contentflywheel.co.uk";
  const fallback = `${baseUrl}/c/${userId}`;
  try {
    const [row] = await db
      .select({ customDomain: storeSettingsTable.customDomain })
      .from(storeSettingsTable)
      .where(eq(storeSettingsTable.userId, userId))
      .limit(1);
    const domain = row?.customDomain?.trim();
    return domain ? `https://${domain}` : fallback;
  } catch {
    return fallback;
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

async function getTodayStats(userId: string) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  try {
    const [ordersRow, subRow] = await Promise.all([
      db.select({
        todayCents: sql<number>`COALESCE(SUM(${productOrdersTable.amountCents}), 0)`,
        todayOrders: sql<number>`COUNT(*)`,
      })
        .from(productOrdersTable)
        .where(and(eq(productOrdersTable.creatorUserId, userId), eq(productOrdersTable.status, "completed"), gte(productOrdersTable.createdAt, todayStart)))
        .then((r) => r[0]),
      db.select({ cnt: sql<number>`COUNT(*)::int` })
        .from(emailContactsTable)
        .where(and(eq(emailContactsTable.userId, userId), isNull(emailContactsTable.unsubscribedAt), gte(emailContactsTable.subscribedAt, todayStart)))
        .then((r) => r[0]),
    ]);
    return {
      todayCents: Number(ordersRow?.todayCents ?? 0),
      todayOrders: Number(ordersRow?.todayOrders ?? 0),
      todaySubscribers: Number(subRow?.cnt ?? 0),
    };
  } catch {
    return { todayCents: 0, todayOrders: 0, todaySubscribers: 0 };
  }
}

async function getEmailSubscriberCount(userId: string): Promise<number> {
  try {
    const [row] = await db.select({ count: count() }).from(emailContactsTable)
      .where(and(eq(emailContactsTable.userId, userId), isNull(emailContactsTable.unsubscribedAt)));
    return Number(row?.count ?? 0);
  } catch { return 0; }
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
  } catch { return []; }
}

async function getVideoStats(userId: string) {
  let tiktokCount = 0;
  let productsCount = 0;
  let totalLibraryVideos = 0;
  const recent: RecentVideoItem[] = [];

  const productWhere = and(eq(productsTable.userId, userId), isNull(productsTable.deletedAt));
  try {
    const row = await db.select({ count: count() }).from(productsTable).where(productWhere);
    const raw = row[0]?.count;
    productsCount = typeof raw === "bigint" ? Number(raw) : Number(raw ?? 0);
  } catch { /* silent */ }

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
      ...ugcJobs.map((j) => ({ id: j.id, title: (j.hookPreview || "UGC video").slice(0, 60), createdAt: j.createdAt!, href: "/dashboard/ugc-lab", source: "ugc-lab" as const })),
      ...tiktokVideos.map((v) => ({ id: v.id, title: (v.productLink || "TikTok video").slice(0, 60), createdAt: v.createdAt!, href: "/dashboard/tiktok-shop", source: "tiktok-shop" as const })),
    ];
    recent.push(...withSource.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 5));
  } catch { /* silent */ }

  return { digitalProductsCount: productsCount, tiktokShopCount: tiktokCount, totalLibraryVideos, recent };
}

// ─── Quick-start tools ─────────────────────────────────────────────────────────

const QUICKSTART_TOOLS = [
  { href: "/dashboard/launch",    emoji: "🚀", label: "Launch with AI", desc: "Idea → research → product → launch" },
  { href: "/dashboard/workspace", emoji: "🔍", label: "Research",        desc: "Validate your niche and idea"       },
  { href: "/dashboard/ai-coach",  emoji: "🤖", label: "AI Coach",        desc: "Get strategy and copy help"         },
];

const ALL_TOOLS = [
  { href: "/dashboard/ai-coach",         emoji: "🤖", label: "AI Coach",       desc: "Chat, plan, generate content"        },
  { href: "/dashboard/digital-products", emoji: "📦", label: "Create Product", desc: "AI writes your eBook or guide"       },
  { href: "/dashboard/design-studio",    emoji: "🎨", label: "Design Studio",  desc: "Covers, graphics, bulk posts"        },
  { href: "/dashboard/video-guide/new",  emoji: "🎬", label: "Video Guide",    desc: "Script + scenes in 30 sec"           },
  { href: "/dashboard/email-marketing",  emoji: "📧", label: "Email",          desc: "Campaigns + subscriber list"         },
  { href: "/dashboard/store",            emoji: "🏪", label: "My Store",       desc: "Products, orders, payouts"           },
];

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const { userId } = await auth();

  const [videoStats, incompleteProducts, emailSubscribers, profileRow, revenue, todayStats, storeUrl] = userId
    ? await Promise.all([
        getVideoStats(userId),
        getIncompleteProducts(userId),
        getEmailSubscriberCount(userId),
        db.select({ videoCredits: profilesTable.videoCredits }).from(profilesTable).where(eq(profilesTable.userId, userId)).limit(1).then(r => r[0] ?? null).catch(() => null),
        getActualRevenue(userId),
        getTodayStats(userId),
        getActiveStoreUrl(userId),
      ])
    : [
        { digitalProductsCount: 0, tiktokShopCount: 0, totalLibraryVideos: 0, recent: [] as RecentVideoItem[] },
        [] as IncompleteProduct[],
        0, null,
        { totalCents: 0, totalOrders: 0 },
        { todayCents: 0, todayOrders: 0, todaySubscribers: 0 },
        "",
      ];

  const { totalCents, totalOrders } = revenue as { totalCents: number; totalOrders: number };
  const revenueGBP = (totalCents / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const { todayCents, todayOrders, todaySubscribers } = todayStats as { todayCents: number; todayOrders: number; todaySubscribers: number };
  const todayRevenueGBP = (todayCents / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const hasTodayActivity = todayCents > 0 || todayOrders > 0 || todaySubscribers > 0;

  // Stage detection
  const isNewUser = (videoStats as { digitalProductsCount: number }).digitalProductsCount === 0;
  const hasRevenue = totalOrders > 0;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const stats = [
    { label: "Products",         display: (videoStats as { digitalProductsCount: number }).digitalProductsCount.toLocaleString(), href: "/dashboard/store",          icon: Package,        grad: "from-blue-500 to-indigo-500"    },
    { label: "All-time Revenue", display: `£${revenueGBP}`,                                                                       href: "/dashboard/store",          icon: PoundSterling,  grad: "from-emerald-500 to-teal-500"   },
    { label: "Subscribers",      display: (emailSubscribers as number).toLocaleString(),                                           href: "/dashboard/email-marketing", icon: Users,          grad: "from-violet-500 to-purple-600"  },
    { label: "Total Orders",     display: totalOrders.toLocaleString(),                                                            href: "/dashboard/orders",         icon: ShoppingBag,    grad: "from-orange-500 to-amber-500"   },
  ];

  return (
    <main className="min-h-full">
      <Suspense fallback={null}><ReferralCapture /></Suspense>
      <Suspense fallback={null}><InviteCapture /></Suspense>
      <SyncOnboardingSteps digitalProductsCount={(videoStats as { digitalProductsCount: number }).digitalProductsCount} />

      {/* ── Launch with AI banner ──────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-orange-500/10 via-amber-500/8 to-orange-500/10 border-b border-orange-500/20 px-4 py-3 sm:px-6">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-orange-500/15 border border-orange-500/25 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-orange-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-foreground">Launch with AI <span className="text-[10px] font-bold text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded-md ml-1">Beta</span></p>
              <p className="text-[11px] text-muted-foreground hidden sm:block">Tell us your idea — AI handles Research → Product → Design → Marketing automatically</p>
            </div>
          </div>
          <Link href="/dashboard/launch" className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[12px] font-bold transition-all shadow-sm shadow-orange-500/20 shrink-0">
            <Rocket className="w-3.5 h-3.5" />Launch Now
          </Link>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          NEW USER — LAUNCH MODE
          ════════════════════════════════════════════════════════════════════ */}
      {isNewUser ? (
        <>
          {/* Hero — launch mode */}
          <div className="relative overflow-hidden bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 px-6 pt-10 pb-12 sm:px-10 border-b border-white/5">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(249,115,22,0.12),transparent_60%)]" />
            <div className="relative max-w-[1200px] mx-auto flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-400 mb-4">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-orange-500" />
                  </span>
                  Beta · Free trial active
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                  Build your first digital product 🚀
                </h1>
                <p className="text-white/50 mt-2 text-base max-w-lg">
                  Describe your idea — AI handles research, product creation, design, and marketing automatically.
                </p>
              </div>
              <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
                <Link
                  href="/dashboard/launch"
                  className="group inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-400 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-500/30 transition-all hover:scale-105"
                >
                  <Rocket className="w-4 h-4" />
                  Launch with AI
                  <ArrowRight className="w-4 h-4 transition group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/dashboard/digital-products"
                  className="text-xs text-white/40 hover:text-white/70 transition-colors underline underline-offset-2"
                >
                  or create manually
                </Link>
              </div>
            </div>
          </div>

          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-8 py-8 space-y-6">

            {/* Checklist — front and centre for new users */}
            <OnboardingChecklist />

            {/* AI Projects — shows if any exist */}
            <ProjectsSection />

            {/* Quick start tools — 3 most relevant for new users */}
            <section>
              <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">Start here</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {QUICKSTART_TOOLS.map(({ href, emoji, label, desc }) => (
                  <Link key={href} href={href} className="group">
                    <div className="flex items-center gap-4 rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-orange-200 dark:hover:border-orange-500/30 transition-all">
                      <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-xl group-hover:bg-orange-500/15 transition-colors shrink-0">{emoji}</div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 dark:text-white text-sm">{label}</p>
                        <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">{desc}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-orange-500 transition-colors ml-auto shrink-0" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            {/* Academy */}
            <Suspense fallback={null}><ContinueLearningCard /></Suspense>

            {/* Stats — de-emphasised for new users, but honest */}
            <section>
              <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">Your stats</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {stats.map(({ label, display, href, icon: Icon, grad }) => (
                  <Link key={label} href={href} className="group">
                    <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] p-4 hover:shadow-md transition-all">
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${grad} flex items-center justify-center mb-2.5 shadow-sm`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <p className="text-2xl font-black text-gray-900 dark:text-white leading-none tabular-nums">{display}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-1">{label}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </>
      ) : (
        /* ════════════════════════════════════════════════════════════════════
           ACTIVE USER — METRICS MODE
           ════════════════════════════════════════════════════════════════════ */
        <>
          {/* Hero — metrics mode */}
          <div className="relative overflow-hidden bg-gradient-to-br from-orange-600 via-amber-400 to-orange-500 px-6 pt-10 pb-16 sm:px-10">
            <div className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 left-10 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
            <div className="relative max-w-[1200px] mx-auto">
              <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">Content Flywheel</p>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                {greeting} 👋
              </h1>
              <p className="text-white/80 mt-2 text-base max-w-lg">
                {hasRevenue
                  ? `£${revenueGBP} earned · ${totalOrders} order${totalOrders !== 1 ? "s" : ""}. Keep the flywheel spinning.`
                  : `${(videoStats as { digitalProductsCount: number }).digitalProductsCount} product${(videoStats as { digitalProductsCount: number }).digitalProductsCount !== 1 ? "s" : ""} created — now let's get your first sale.`}
              </p>
            </div>
          </div>

          <div className="relative -mt-8 max-w-[1200px] mx-auto px-4 sm:px-6 md:px-8 pb-12">

            {/* Stats row — floated over banner */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              {stats.map(({ label, display, href, icon: Icon, grad }) => (
                <Link key={label} href={href} className="group">
                  <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] shadow-lg p-4 hover:shadow-xl hover:-translate-y-1 transition-all duration-150">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center mb-3 shadow-sm`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-3xl font-black text-gray-900 dark:text-white leading-none tabular-nums">{display}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-1.5">{label}</p>
                  </div>
                </Link>
              ))}
            </div>

            {/* Today at a glance */}
            {hasTodayActivity && (
              <div className="rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/10 border border-emerald-500/20 dark:border-emerald-500/10 px-5 py-4 mb-4 flex flex-wrap items-center gap-x-6 gap-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Today</span>
                </div>
                {todayCents > 0 && (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-black text-gray-900 dark:text-white tabular-nums">£{todayRevenueGBP}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">revenue</span>
                  </div>
                )}
                {todayOrders > 0 && (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-black text-gray-900 dark:text-white tabular-nums">{todayOrders}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{todayOrders === 1 ? "order" : "orders"}</span>
                  </div>
                )}
                {todaySubscribers > 0 && (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-black text-gray-900 dark:text-white tabular-nums">+{todaySubscribers}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{todaySubscribers === 1 ? "subscriber" : "subscribers"}</span>
                  </div>
                )}
              </div>
            )}

            {/* Share store */}
            {storeUrl && <ShareStoreBar storeUrl={storeUrl as string} />}

            {/* AI Projects — Growth Mode */}
            <ProjectsSection />

            {/* Incomplete products */}
            {(incompleteProducts as IncompleteProduct[]).length > 0 && (
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
                  {(incompleteProducts as IncompleteProduct[]).map((product) => (
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

            {/* Onboarding checklist (secondary for active users) */}
            <OnboardingChecklist />

            {/* Academy */}
            <Suspense fallback={null}><ContinueLearningCard /></Suspense>

            {/* Tools grid */}
            <section className="mb-6">
              <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">Your tools</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {ALL_TOOLS.map(({ href, emoji, label, desc }) => (
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
            {(videoStats as { recent: RecentVideoItem[] }).recent.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Recent activity</h2>
                  <Link href="/dashboard/library" className="text-xs font-medium text-orange-500 hover:text-orange-400 transition-colors">View all →</Link>
                </div>
                <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] shadow-sm overflow-hidden">
                  <ul className="divide-y divide-gray-100 dark:divide-[#2A2A2A]">
                    {(videoStats as { recent: RecentVideoItem[] }).recent.map((item) => (
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
        </>
      )}
    </main>
  );
}
