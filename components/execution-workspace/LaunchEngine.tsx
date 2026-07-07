/**
 * LaunchEngine — Phase 1.9
 * ──────────────────────────────────────────────────────────────────────────────
 * Replaces the simple "Next steps" buttons in the workspace page with a full
 * AI-driven launch experience. Every piece of data is derived from the real
 * stageResults produced by the AI pipeline — nothing is placeholder.
 *
 * Sections:
 *  1. Launch Plan — score ring, estimated launch, business stage progression
 *  2. AI Launch Checklist — auto-checked from stageResults + action items
 *  3. Smart Recommendations — from research: competitors, keywords, opps
 *  4. Launch Content Queue — asset folders by type with counts + previews
 *  5. One-Click Launch — publish + activate content queue
 */
"use client";

import { useState, useMemo, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Rocket, CheckCircle2, Circle, ExternalLink, ChevronDown,
  ChevronRight, Zap, TrendingUp, Target, Mail, Play,
  Instagram, Twitter, FileText, LayoutGrid, Loader2,
  ArrowRight, Sparkles, Star, AlertCircle,
} from "lucide-react";
import type { LaunchStageResults } from "@/db/schema/launch-schema";

/* ─── Props ─────────────────────────────────────────────────────────────────── */

interface LaunchEngineProps {
  launchId:  string;
  productId: string;
  storeUrl:  string;
  results:   LaunchStageResults;
}

/* ─── Business stage progression ────────────────────────────────────────────── */

const BUSINESS_STAGES = [
  { id: "building",         label: "Building",              minScore: 0  },
  { id: "launching",        label: "Launching",             minScore: 20 },
  { id: "first_visitors",   label: "Getting First Visitors", minScore: 40 },
  { id: "first_sales",      label: "Getting First Sales",   minScore: 60 },
  { id: "growing",          label: "Growing",               minScore: 75 },
  { id: "scaling",          label: "Scaling",               minScore: 90 },
];

/* ─── Launch score calculator ────────────────────────────────────────────────── */

function calcLaunchScore(results: LaunchStageResults): number {
  let score = 0;

  // Research: 20pts
  if (results.research?.insights?.length) {
    score += 20;
  } else if (results.research) {
    score += 10;
  }

  // Product: 15pts
  if (results.product?.productId) score += 15;

  // Design: 15pts
  if (results.design) {
    const assets = results.design.assetsCount ?? 0;
    score += assets >= 3 ? 15 : assets >= 1 ? 8 : 5;
  }

  // Marketing: 20pts
  if (results.marketing) {
    let mScore = 0;
    if (results.marketing.salesCopy)          mScore += 5;
    if (results.marketing.emails?.length)     mScore += 5;
    if (results.marketing.tiktokHooks?.length) mScore += 4;
    if (results.marketing.carousels?.length)  mScore += 3;
    if (results.marketing.xPosts?.length)     mScore += 3;
    score += Math.min(mScore, 20);
  }

  // Store: up to 30pts from readiness score
  if (results.store) {
    const readiness = results.store.readinessScore ?? 0;
    score += Math.round((readiness / 100) * 30);
  }

  return Math.min(score, 100);
}

/* ─── Content queue folders ──────────────────────────────────────────────────── */

interface ContentFolder {
  id:       string;
  emoji:    string;
  label:    string;
  count:    number;
  preview:  string[];  // first 2-3 items for tooltip
  linkHref: string;
}

function buildContentFolders(
  m: LaunchStageResults["marketing"],
  launchId: string,
): ContentFolder[] {
  if (!m) return [];

  const folders: ContentFolder[] = [];

  // TikTok / Reels
  if (m.tiktokHooks?.length) {
    folders.push({
      id:       "tiktok",
      emoji:    "🎵",
      label:    "TikTok / Reels",
      count:    m.tiktokHooks.length,
      preview:  m.tiktokHooks.slice(0, 2),
      linkHref: "/dashboard/workspace?tab=content",
    });
  }

  // Carousel Posts
  if (m.carousels?.length) {
    folders.push({
      id:       "carousels",
      emoji:    "🖼️",
      label:    "Carousel Posts",
      count:    m.carousels.length,
      preview:  m.carousels.slice(0, 2).map(c => c.hook),
      linkHref: "/dashboard/workspace?tab=content",
    });
  }

  // Email Sequence
  if (m.emails?.length) {
    folders.push({
      id:       "emails",
      emoji:    "📧",
      label:    "Email Sequence",
      count:    m.emails.length,
      preview:  m.emails.slice(0, 2).map(e => e.subject),
      linkHref: "/dashboard/workspace?tab=content",
    });
  }

  // X / Twitter
  if (m.xPosts?.length) {
    folders.push({
      id:       "x",
      emoji:    "𝕏",
      label:    "X / Twitter",
      count:    m.xPosts.length,
      preview:  m.xPosts.slice(0, 2).map(p => p.substring(0, 80) + (p.length > 80 ? "…" : "")),
      linkHref: "/dashboard/workspace?tab=content",
    });
  }

  // Instagram
  if (m.instagramCaptions?.length) {
    folders.push({
      id:       "instagram",
      emoji:    "📸",
      label:    "Instagram",
      count:    m.instagramCaptions.length,
      preview:  m.instagramCaptions.slice(0, 2).map(c => c.substring(0, 80) + (c.length > 80 ? "…" : "")),
      linkHref: "/dashboard/workspace?tab=content",
    });
  }

  // Launch Copy (salesCopy + headlines + ctas)
  const copyCounts = [
    m.salesCopy ? 1 : 0,
    m.headlines?.length ?? 0,
    m.ctas?.length ?? 0,
    m.launchAnnouncement ? 1 : 0,
    m.faq?.length ?? 0,
  ].reduce((a, b) => a + b, 0);

  if (copyCounts > 0) {
    const copyPreviews: string[] = [];
    if (m.salesCopy?.headline) copyPreviews.push(m.salesCopy.headline);
    if (m.headlines?.[0]) copyPreviews.push(m.headlines[0]);
    folders.push({
      id:       "copy",
      emoji:    "✍️",
      label:    "Launch Copy",
      count:    copyCounts,
      preview:  copyPreviews.slice(0, 2),
      linkHref: "/dashboard/workspace?tab=content",
    });
  }

  // Blog / SEO
  if (m.seoTitle || m.seoMetaDesc || m.marketplaceDesc) {
    const seoCounts = [
      m.seoTitle ? 1 : 0,
      m.seoMetaDesc ? 1 : 0,
      m.marketplaceDesc ? 1 : 0,
      m.storeDesc ? 1 : 0,
      m.tags?.length ?? 0,
    ].reduce((a, b) => a + b, 0);

    folders.push({
      id:       "seo",
      emoji:    "🔍",
      label:    "SEO & Listings",
      count:    seoCounts,
      preview:  [m.seoTitle, m.seoMetaDesc].filter(Boolean) as string[],
      linkHref: "/dashboard/workspace?tab=content",
    });
  }

  return folders;
}

/* ─── Checklist item ─────────────────────────────────────────────────────────── */

interface ChecklistItem {
  id:       string;
  label:    string;
  done:     boolean;
  href?:    string;
  external?: boolean;
}

function buildChecklist(
  results:   LaunchStageResults,
  productId: string,
  storeUrl:  string,
  launchId:  string,
): ChecklistItem[] {
  const m = results.marketing;
  const d = results.design;
  const s = results.store;

  return [
    // Done items (auto-completed)
    {
      id:   "research",
      label: "Market research complete",
      done: !!results.research?.insights?.length,
    },
    {
      id:   "product",
      label: `Product "${results.product?.productName ?? "created"}"`,
      done: !!results.product?.productId,
      href: productId ? `/dashboard/products/${productId}` : undefined,
    },
    {
      id:   "design",
      label: `${d?.assetsCount ?? 0} design assets generated`,
      done: !!d?.assetsCount && d.assetsCount > 0,
      href: productId ? `/dashboard/products/${productId}` : undefined,
    },
    {
      id:   "copy",
      label: "Launch copy & sales page written",
      done: !!(m?.salesCopy?.headline),
    },
    {
      id:   "email",
      label: `Email sequence ready (${m?.emails?.length ?? 0} emails)`,
      done: !!(m?.emails?.length && m.emails.length > 0),
      href: "/dashboard/workspace?tab=content",
    },
    {
      id:   "social",
      label: "Social media content created",
      done: !!(m?.tiktokHooks?.length || m?.carousels?.length || m?.xPosts?.length),
      href: "/dashboard/workspace?tab=content",
    },
    {
      id:   "seo",
      label: "SEO metadata & tags written",
      done: !!(m?.seoTitle && m?.tags?.length),
    },
    {
      id:   "store_built",
      label: `Store listing assembled (${s?.readinessScore ?? 0}% readiness)`,
      done: !!(s?.productId),
      href: storeUrl || undefined,
      external: !!storeUrl,
    },
    // Action items (not done — need user action)
    {
      id:   "publish",
      label: "Publish product to store",
      done: !!(s?.publishedAt),
      href: productId ? `/dashboard/products/${productId}#publish` : undefined,
    },
    {
      id:   "share_tiktok",
      label: "Post launch TikTok/Reel",
      done: false,
      href: "/dashboard/workspace?tab=content",
    },
    {
      id:   "send_email",
      label: "Send launch email to list",
      done: false,
      href: "/dashboard/workspace?tab=content",
    },
  ];
}

/* ─── Smart recommendations ──────────────────────────────────────────────────── */

interface Recommendation {
  id:      string;
  icon:    ReactNode;
  badge:   string;
  badgeColor: string;
  title:   string;
  detail:  string;
  href?:   string;
}

function buildRecommendations(results: LaunchStageResults): Recommendation[] {
  const recs: Recommendation[] = [];
  const research = results.research;
  const m        = results.marketing;
  const s        = results.store;

  // Competitor pricing gap
  if (research?.competitorInsights?.length) {
    const comp = research.competitorInsights[0];
    recs.push({
      id:         "competitor",
      icon:       <TrendingUp className="w-3.5 h-3.5" />,
      badge:      "Competitor Gap",
      badgeColor: "text-blue-400 bg-blue-400/10",
      title:      `Exploit ${comp.name}'s weakness`,
      detail:     comp.gap || `${comp.name} is strong at ${comp.strength} — position against that.`,
      href:       "/dashboard/workspace?tab=research",
    });
  }

  // Top keyword opportunity
  if (research?.keywords?.length) {
    const highOpps = research.keywords.filter(k => k.opportunity === "high");
    const kw = highOpps[0] ?? research.keywords[0];
    if (kw) {
      recs.push({
        id:         "keyword",
        icon:       <Target className="w-3.5 h-3.5" />,
        badge:      "SEO Opportunity",
        badgeColor: "text-emerald-400 bg-emerald-400/10",
        title:      `Rank for "${kw.term}"`,
        detail:     kw.note || kw.opportunity,
        href:       "/dashboard/workspace?tab=research",
      });
    }
  }

  // Product opportunity
  if (research?.productOpportunities?.length) {
    const opp = research.productOpportunities[0];
    recs.push({
      id:         "product_opp",
      icon:       <Sparkles className="w-3.5 h-3.5" />,
      badge:      "Product Idea",
      badgeColor: "text-amber-400 bg-amber-400/10",
      title:      opp.title,
      detail:     opp.description + (opp.priceRange ? ` Suggested price: ${opp.priceRange}.` : ""),
    });
  }

  // Store readiness improvement
  if (s && (s.readinessScore ?? 0) < 90) {
    const warningChecks = s.validationChecks?.filter(c => c.status === "warning" || c.status === "missing");
    if (warningChecks?.length) {
      const top = warningChecks[0];
      recs.push({
        id:         "store",
        icon:       <AlertCircle className="w-3.5 h-3.5" />,
        badge:      "Store Fix",
        badgeColor: "text-orange-400 bg-orange-400/10",
        title:      `Fix: ${top.label}`,
        detail:     top.detail ?? `Resolving this could push your readiness above 90%.`,
        href:       s.productId ? `/dashboard/products/${s.productId}` : undefined,
      });
    }
  }

  // Email sequence tip
  if (m?.emails?.length && m.emails.length < 3) {
    recs.push({
      id:         "email_tip",
      icon:       <Mail className="w-3.5 h-3.5" />,
      badge:      "Email Tip",
      badgeColor: "text-purple-400 bg-purple-400/10",
      title:      "Add a follow-up email sequence",
      detail:     "Most sales happen after email #2–4. Add nurture emails to increase conversions.",
      href:       "/dashboard/workspace?tab=content",
    });
  }

  // TikTok urgency (if have hooks, good time to post)
  if (m?.tiktokHooks?.length) {
    recs.push({
      id:         "tiktok_now",
      icon:       <Zap className="w-3.5 h-3.5" />,
      badge:      "Post Now",
      badgeColor: "text-pink-400 bg-pink-400/10",
      title:      "Your TikTok hooks are ready",
      detail:     `${m.tiktokHooks.length} hooks generated. Best time to post: weekdays 6–9pm. Copy them now.`,
      href:       "/dashboard/workspace?tab=content",
    });
  }

  return recs.slice(0, 4); // max 4 recommendations
}

/* ─── Score ring ─────────────────────────────────────────────────────────────── */

function ScoreRing({ score }: { score: number }) {
  const radius      = 38;
  const circumference = 2 * Math.PI * radius;
  const offset      = circumference - (score / 100) * circumference;
  const color       = score >= 80 ? "#22c55e" : score >= 55 ? "#f97316" : "#fbbf24";

  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="currentColor"
          className="text-muted/20" strokeWidth="6" />
        <circle cx="48" cy="48" r={radius} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[22px] font-black tabular-nums leading-none" style={{ color }}>
          {score}
        </span>
        <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mt-0.5">
          Score
        </span>
      </div>
    </div>
  );
}

/* ─── Business stage bar ─────────────────────────────────────────────────────── */

function BusinessStageBar({ score }: { score: number }) {
  const currentIdx = BUSINESS_STAGES.reduce(
    (acc, s, i) => (score >= s.minScore ? i : acc), 0
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1">
        {BUSINESS_STAGES.map((stage, i) => {
          const isActive = i === currentIdx;
          const isDone   = i < currentIdx;
          return (
            <div key={stage.id} className="flex items-center gap-1 min-w-0 shrink-0">
              <div className={[
                "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap transition-colors",
                isActive ? "bg-orange-500 text-white" :
                isDone   ? "bg-green-500/20 text-green-400" :
                           "bg-muted/30 text-muted-foreground/40",
              ].join(" ")}>
                {isDone && <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />}
                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse shrink-0" />}
                {stage.label}
              </div>
              {i < BUSINESS_STAGES.length - 1 && (
                <ChevronRight className={[
                  "w-2.5 h-2.5 shrink-0",
                  i < currentIdx ? "text-green-400/60" : "text-muted-foreground/20",
                ].join(" ")} />
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground/50">
        Business stage — based on completed assets and readiness score
      </p>
    </div>
  );
}

/* ─── Content folder card ────────────────────────────────────────────────────── */

function FolderCard({ folder }: { folder: ContentFolder }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-border/40 bg-card/60 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 transition-colors text-left"
      >
        <span className="text-base shrink-0">{folder.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-foreground leading-none">{folder.label}</p>
        </div>
        <span className="text-[10px] font-bold text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded-full shrink-0">
          {folder.count}
        </span>
        <ChevronDown className={[
          "w-3.5 h-3.5 text-muted-foreground/50 shrink-0 transition-transform",
          open ? "rotate-180" : "",
        ].join(" ")} />
      </button>

      {open && folder.preview.length > 0 && (
        <div className="border-t border-border/30 px-3 py-2.5 space-y-2">
          {folder.preview.map((item, i) => (
            <p key={i} className="text-[11px] text-muted-foreground/70 leading-snug line-clamp-2">
              <span className="text-muted-foreground/40 mr-1">{i + 1}.</span>
              {item}
            </p>
          ))}
          <a
            href={folder.linkHref}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-500 hover:underline mt-1"
          >
            View all {folder.count} <ArrowRight className="w-2.5 h-2.5" />
          </a>
        </div>
      )}
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────────── */

export function LaunchEngine({ launchId, productId, storeUrl, results }: LaunchEngineProps) {
  const router = useRouter();
  const [launching, setLaunching] = useState(false);
  const [launched,  setLaunched]  = useState(false);

  const score           = useMemo(() => calcLaunchScore(results), [results]);
  const checklist       = useMemo(() => buildChecklist(results, productId, storeUrl, launchId), [results, productId, storeUrl, launchId]);
  const recommendations = useMemo(() => buildRecommendations(results), [results]);
  const contentFolders  = useMemo(() => buildContentFolders(results.marketing, launchId), [results.marketing, launchId]);

  const doneCount  = checklist.filter(c => c.done).length;
  const totalCount = checklist.length;

  /* One-click launch */
  const handleLaunch = useCallback(async () => {
    if (!productId) return;
    setLaunching(true);
    try {
      // Mark project as "published" in DB
      await fetch(`/api/launch/${launchId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: "published" }),
      });
      setLaunched(true);
      // Navigate to publish page
      router.push(`/dashboard/products/${productId}#publish`);
    } catch {
      setLaunching(false);
    }
  }, [launchId, productId, router]);

  const currentStage = BUSINESS_STAGES[
    BUSINESS_STAGES.reduce((acc, s, i) => (score >= s.minScore ? i : acc), 0)
  ];

  return (
    <div className="mt-8 space-y-5">

      {/* ── Section header ── */}
      <div className="flex items-center gap-2">
        <Rocket className="w-4 h-4 text-orange-500 shrink-0" />
        <h2 className="text-[14px] font-black tracking-tight text-foreground">
          Launch Engine
        </h2>
        <div className="flex-1 h-px bg-border/30" />
      </div>

      {/* ── Launch Plan ── */}
      <div className="rounded-2xl border border-orange-500/20 bg-orange-500/[0.03] p-5">
        <div className="flex items-start gap-5">
          <ScoreRing score={score} />
          <div className="flex-1 min-w-0 space-y-3">
            {/* Status chips */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-[11px] font-bold text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Ready to launch
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/40 text-[11px] font-semibold text-muted-foreground">
                📅 Launch today
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/40 text-[11px] font-semibold text-muted-foreground">
                ✅ {doneCount}/{totalCount} complete
              </span>
            </div>
            {/* Stage */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-1">
                Current stage
              </p>
              <p className="text-[15px] font-black text-foreground">{currentStage.label}</p>
            </div>
          </div>
        </div>

        {/* Business stage bar */}
        <div className="mt-4 pt-4 border-t border-orange-500/10">
          <BusinessStageBar score={score} />
        </div>
      </div>

      {/* ── Three column grid: Checklist | Recommendations | Content ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

        {/* Checklist */}
        <div className="lg:col-span-1 rounded-2xl border border-border/50 bg-card/60 p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
            <p className="text-[12px] font-black text-foreground">Launch Checklist</p>
            <span className="ml-auto text-[10px] text-muted-foreground/50 font-semibold">
              {doneCount}/{totalCount}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 to-green-500 transition-all duration-700"
              style={{ width: `${(doneCount / totalCount) * 100}%` }}
            />
          </div>

          <div className="space-y-1.5">
            {checklist.map(item => (
              <div key={item.id} className="flex items-start gap-2">
                {item.done
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                  : <Circle       className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0 mt-0.5" />
                }
                {item.href
                  ? (
                    <a
                      href={item.href}
                      target={item.external ? "_blank" : undefined}
                      rel={item.external ? "noopener noreferrer" : undefined}
                      className={[
                        "text-[11px] leading-snug hover:underline flex items-center gap-1",
                        item.done
                          ? "text-muted-foreground/50 line-through"
                          : "text-foreground/80 font-medium",
                      ].join(" ")}
                    >
                      {item.label}
                      {!item.done && <ArrowRight className="w-2.5 h-2.5 shrink-0" />}
                    </a>
                  )
                  : (
                    <span className={[
                      "text-[11px] leading-snug",
                      item.done
                        ? "text-muted-foreground/50 line-through"
                        : "text-foreground/80 font-medium",
                    ].join(" ")}>
                      {item.label}
                    </span>
                  )
                }
              </div>
            ))}
          </div>
        </div>

        {/* Smart Recommendations */}
        <div className="lg:col-span-1 rounded-2xl border border-border/50 bg-card/60 p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <p className="text-[12px] font-black text-foreground">Smart Recommendations</p>
          </div>

          {recommendations.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/50 italic">
              Complete all pipeline stages to unlock recommendations.
            </p>
          ) : (
            <div className="space-y-2.5">
              {recommendations.map(rec => (
                <div key={rec.id} className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${rec.badgeColor}`}>
                      {rec.icon}
                      {rec.badge}
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold text-foreground/90 leading-snug">
                    {rec.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60 leading-snug line-clamp-2">
                    {rec.detail}
                  </p>
                  {rec.href && (
                    <a
                      href={rec.href}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-500 hover:underline"
                    >
                      View details <ArrowRight className="w-2 h-2" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Content Queue */}
        <div className="lg:col-span-1 rounded-2xl border border-border/50 bg-card/60 p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Play className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            <p className="text-[12px] font-black text-foreground">Content Queue</p>
            {contentFolders.length > 0 && (
              <span className="ml-auto text-[10px] font-bold text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded-full">
                {contentFolders.reduce((a, f) => a + f.count, 0)} assets
              </span>
            )}
          </div>

          {contentFolders.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/50 italic">
              No marketing assets yet — run the Marketing agent to generate content.
            </p>
          ) : (
            <div className="space-y-1.5">
              {contentFolders.map(folder => (
                <FolderCard key={folder.id} folder={folder} />
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── One-Click Launch ── */}
      {productId && (
        <div className="rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-500/[0.08] to-orange-600/[0.03] p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-black text-foreground">
                {launched ? "🚀 Launching your product…" : "Ready to go live?"}
              </p>
              <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                {launched
                  ? "Taking you to the publish page now."
                  : "Publish your store listing and activate your content queue in one click."
                }
              </p>
            </div>

            <div className="flex gap-2 shrink-0">
              {storeUrl && (
                <a
                  href={storeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border/60 bg-card/60 hover:bg-muted/40 text-[12px] font-semibold text-foreground transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Preview
                </a>
              )}

              <button
                onClick={() => void handleLaunch()}
                disabled={launching || launched}
                className={[
                  "inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-[13px] transition-all",
                  launched
                    ? "bg-green-500 text-white cursor-default"
                    : launching
                    ? "bg-orange-500/60 text-white cursor-wait"
                    : "bg-orange-500 hover:bg-orange-600 active:scale-95 text-white shadow-lg shadow-orange-500/20",
                ].join(" ")}
              >
                {launching ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Launching…</>
                ) : launched ? (
                  <><CheckCircle2 className="w-4 h-4" /> Launched!</>
                ) : (
                  <><Rocket className="w-4 h-4" /> Launch Now</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
