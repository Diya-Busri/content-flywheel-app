"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  CheckCircle2, Circle, ArrowRight, ChevronDown, ChevronUp,
  Search, Package, ImageIcon, Store, CreditCard, Megaphone, PartyPopper,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ApiStatus = {
  hasProduct: boolean;
  hasThumbnail: boolean;
  hasPublishedProduct: boolean;
  hasStripeConnect: boolean;
  hasMarketingContent: boolean;
  hasSale: boolean;
  complete: boolean;
  percentComplete: number;
};

type StepKey =
  | "hasResearched"
  | "hasProduct"
  | "hasThumbnail"
  | "hasPublishedProduct"
  | "hasStripeConnect"
  | "hasMarketingContent"
  | "hasSale";

type Step = {
  key: StepKey;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  desc: string;
  href: string;
  cta: string;
};

// ─── Step definitions (in launch order) ──────────────────────────────────────

const STEPS: Step[] = [
  {
    key: "hasResearched",
    icon: Search,
    label: "Research your niche and idea",
    desc: "Use the Research tool to validate your topic and understand your audience before you build.",
    href: "/dashboard/workspace",
    cta: "Open Research →",
  },
  {
    key: "hasProduct",
    icon: Package,
    label: "Create your first product",
    desc: "Type your idea — AI writes and formats a complete eBook, guide, or template in minutes.",
    href: "/dashboard/digital-products",
    cta: "Create product →",
  },
  {
    key: "hasThumbnail",
    icon: ImageIcon,
    label: "Design your product cover",
    desc: "A great cover image significantly increases sales. Use the Design Studio to create one.",
    href: "/dashboard/design-studio",
    cta: "Open Design Studio →",
  },
  {
    key: "hasPublishedProduct",
    icon: Store,
    label: "Publish your store",
    desc: "Make your product live on your store so buyers can find and purchase it.",
    href: "/dashboard/store",
    cta: "Go to store →",
  },
  {
    key: "hasStripeConnect",
    icon: CreditCard,
    label: "Connect Stripe payments",
    desc: "Link your Stripe account so you can accept payments and receive payouts to your bank.",
    href: "/dashboard/settings#payments",
    cta: "Connect Stripe →",
  },
  {
    key: "hasMarketingContent",
    icon: Megaphone,
    label: "Promote your product",
    desc: "Share your store link, create a discount code, or send an email campaign to get your first buyers.",
    href: "/dashboard/email-marketing",
    cta: "Start marketing →",
  },
  {
    key: "hasSale",
    icon: PartyPopper,
    label: "Make your first sale 🎉",
    desc: "Your store is live and you're promoting it — now share the link and watch the orders come in.",
    href: "/dashboard/store",
    cta: "Share store →",
  },
];

const RESEARCH_KEY = "cf_researched_niche";
const DISMISSED_KEY = "cf_onboarding_v2_dismissed";

// ─── Component ────────────────────────────────────────────────────────────────

export function OnboardingChecklist() {
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null);
  const [hasResearched, setHasResearched] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY) === "1") {
      setDismissed(true);
      return;
    }
    setHasResearched(localStorage.getItem(RESEARCH_KEY) === "1");

    fetch("/api/onboarding-status")
      .then((r) => r.ok ? r.json() : null)
      .then((data: ApiStatus | null) => { if (data) setApiStatus(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Mark research step done and navigate
  const markResearched = () => {
    localStorage.setItem(RESEARCH_KEY, "1");
    setHasResearched(true);
  };

  if (dismissed || (!loading && apiStatus?.complete && hasResearched)) return null;

  // Build completion map
  const completionMap: Record<StepKey, boolean> = {
    hasResearched,
    hasProduct: apiStatus?.hasProduct ?? false,
    hasThumbnail: apiStatus?.hasThumbnail ?? false,
    hasPublishedProduct: apiStatus?.hasPublishedProduct ?? false,
    hasStripeConnect: apiStatus?.hasStripeConnect ?? false,
    hasMarketingContent: apiStatus?.hasMarketingContent ?? false,
    hasSale: apiStatus?.hasSale ?? false,
  };

  const completedCount = STEPS.filter((s) => completionMap[s.key]).length;
  const totalSteps = STEPS.length;
  const pct = Math.round((completedCount / totalSteps) * 100);

  // First incomplete step = the "next" step
  const nextStepIndex = STEPS.findIndex((s) => !completionMap[s.key]);

  // Auto-collapse only after user has completed > 3 steps AND explicitly collapsed
  const isEarlyUser = completedCount <= 2;

  return (
    <div className="mb-6 rounded-2xl border border-orange-200 dark:border-orange-900/40 bg-orange-50 dark:bg-orange-950/10 overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer select-none"
        onClick={() => !isEarlyUser && setCollapsed((v) => !v)}
      >
        <div className="flex items-center gap-4 min-w-0 flex-1">
          {/* Progress ring */}
          <div className="relative shrink-0 w-11 h-11">
            <svg viewBox="0 0 44 44" className="w-11 h-11 -rotate-90">
              <circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeWidth="3.5" className="text-orange-200 dark:text-orange-900/60" />
              <circle
                cx="22" cy="22" r="18" fill="none"
                stroke="currentColor" strokeWidth="3.5"
                strokeDasharray={`${(pct / 100) * 2 * Math.PI * 18} ${2 * Math.PI * 18}`}
                strokeLinecap="round"
                className="text-orange-500 transition-all duration-700"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-orange-600 dark:text-orange-400">
              {completedCount}/{totalSteps}
            </span>
          </div>

          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
              {completedCount === 0
                ? "Your launch roadmap"
                : completedCount === totalSteps
                ? "Launch complete 🎉"
                : `${totalSteps - completedCount} step${totalSteps - completedCount > 1 ? "s" : ""} to launch`}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <div className="h-1.5 w-36 rounded-full bg-orange-200 dark:bg-orange-900/50 overflow-hidden">
                <div
                  className="h-full bg-orange-500 rounded-full transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs text-orange-600 dark:text-orange-400 font-semibold tabular-nums">{pct}%</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-3">
          {!isEarlyUser && (
            <button className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-black/5 transition-colors">
              {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              localStorage.setItem(DISMISSED_KEY, "1");
              setDismissed(true);
            }}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-black/5 transition-colors text-xs"
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Steps ──────────────────────────────────────────────────────────── */}
      {(!collapsed || isEarlyUser) && (
        <div className="px-4 pb-4 space-y-2">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-xl bg-orange-100/60 dark:bg-orange-900/20 animate-pulse" />
              ))}
            </div>
          ) : (
            STEPS.map((step, idx) => {
              const done = completionMap[step.key];
              const isNext = idx === nextStepIndex;
              const Icon = step.icon;

              return (
                <div
                  key={step.key}
                  className={`flex items-start gap-3 p-3.5 rounded-xl transition-all ${
                    done
                      ? "opacity-50"
                      : isNext
                      ? "bg-white dark:bg-gray-900 border border-orange-300 dark:border-orange-700/60 shadow-sm shadow-orange-100 dark:shadow-orange-900/20"
                      : "bg-white/50 dark:bg-gray-900/40 border border-gray-100/80 dark:border-gray-800/60"
                  }`}
                >
                  {/* Icon / check */}
                  <div className={`shrink-0 mt-0.5 ${done ? "text-green-500" : isNext ? "text-orange-500" : "text-gray-300 dark:text-gray-600"}`}>
                    {done
                      ? <CheckCircle2 size={18} />
                      : isNext
                      ? (
                        <div className="relative">
                          <div className="w-[18px] h-[18px] rounded-full border-2 border-orange-400 bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center">
                            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                          </div>
                        </div>
                      )
                      : <Circle size={18} />
                    }
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {isNext && !done && (
                          <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-orange-500 bg-orange-100 dark:bg-orange-900/50 px-1.5 py-0.5 rounded-md">
                            Next
                          </span>
                        )}
                        <p className={`text-sm font-semibold leading-snug ${
                          done ? "line-through text-gray-400" : "text-gray-900 dark:text-white"
                        }`}>
                          {step.label}
                        </p>
                      </div>
                      {!done && (
                        <Link
                          href={step.href}
                          onClick={step.key === "hasResearched" ? markResearched : undefined}
                          className={`shrink-0 flex items-center gap-1 text-xs font-semibold whitespace-nowrap transition-colors ${
                            isNext
                              ? "text-orange-600 dark:text-orange-400 hover:text-orange-700"
                              : "text-gray-400 dark:text-gray-500 hover:text-orange-500"
                          }`}
                        >
                          {step.cta}
                          <ArrowRight size={11} />
                        </Link>
                      )}
                    </div>
                    {!done && (isNext || !done) && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed line-clamp-1">
                        {step.desc}
                      </p>
                    )}
                  </div>

                  {/* Step icon accent */}
                  {!done && isNext && (
                    <div className="shrink-0 w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center mt-0.5">
                      <Icon className="w-3.5 h-3.5 text-orange-500" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
