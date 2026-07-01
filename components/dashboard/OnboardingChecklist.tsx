"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, X } from "lucide-react";

type Status = {
  hasProduct: boolean;
  hasPublishedProduct: boolean;
  hasStripeConnect: boolean;
  hasBrandVoice: boolean;
  hasPromoCode: boolean;
  hasEmailSequence: boolean;
  hasSale: boolean;
  complete: boolean;
  percentComplete: number;
};

const STEPS = [
  {
    key: "hasProduct" as keyof Status,
    label: "Create your first product",
    desc: "Use AI to generate an eBook, guide, or template",
    href: "/dashboard/digital-products",
    cta: "Create product →",
  },
  {
    key: "hasPublishedProduct" as keyof Status,
    label: "Publish to your store",
    desc: "Make your product live so buyers can find and purchase it",
    href: "/dashboard/store",
    cta: "Go to store →",
  },
  {
    key: "hasStripeConnect" as keyof Status,
    label: "Set up payouts",
    desc: "Connect Stripe to receive revenue directly to your bank",
    href: "/dashboard/store/payouts",
    cta: "Set up payouts →",
  },
  {
    key: "hasBrandVoice" as keyof Status,
    label: "Set up your brand voice",
    desc: "Help AI write in your tone and style for all content",
    href: "/dashboard/brand-builder",
    cta: "Set up brand →",
  },
  {
    key: "hasPromoCode" as keyof Status,
    label: "Create a discount code",
    desc: "Launch with a promo code to drive your first sales",
    href: "/dashboard/discount-codes",
    cta: "Create code →",
  },
  {
    key: "hasEmailSequence" as keyof Status,
    label: "Set up an email sequence",
    desc: "Automatically follow up with buyers after purchase",
    href: "/dashboard/email-sequences",
    cta: "Create sequence →",
  },
  {
    key: "hasSale" as keyof Status,
    label: "Make your first sale 🎉",
    desc: "Share your store link and watch the revenue roll in",
    href: "/dashboard/store",
    cta: "View store →",
  },
];

const DISMISSED_KEY = "cf_onboarding_dismissed";

export function OnboardingChecklist() {
  const [status, setStatus] = useState<Status | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(DISMISSED_KEY) === "1") {
      setDismissed(true);
      return;
    }
    fetch("/api/onboarding-status")
      .then((r) => r.ok ? r.json() : null)
      .then((data: Status | null) => {
        if (data) setStatus(data);
      })
      .catch(() => {});
  }, []);

  if (dismissed || !status || status.complete) return null;

  const completedCount = STEPS.filter((s) => status[s.key] === true).length;

  return (
    <div className="mb-6 rounded-2xl border border-orange-200 dark:border-orange-900/40 bg-orange-50 dark:bg-orange-950/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 cursor-pointer" onClick={() => setExpanded((v) => !v)}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0 w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-black">
            {completedCount}/{STEPS.length}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 dark:text-white">Get started with Content Flywheel</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="h-1.5 w-40 rounded-full bg-orange-200 dark:bg-orange-900/50 overflow-hidden">
                <div
                  className="h-full bg-orange-500 rounded-full transition-all duration-500"
                  style={{ width: `${status.percentComplete}%` }}
                />
              </div>
              <span className="text-xs text-orange-600 dark:text-orange-400 font-semibold">{status.percentComplete}%</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
          <button
            onClick={(e) => {
              e.stopPropagation();
              localStorage.setItem(DISMISSED_KEY, "1");
              setDismissed(true);
            }}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            title="Dismiss checklist"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Steps */}
      {expanded && (
        <div className="px-5 pb-5 space-y-2">
          {STEPS.map((step) => {
            const done = status[step.key] === true;
            return (
              <div
                key={step.key}
                className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${done ? "opacity-60" : "bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm"}`}
              >
                {done ? (
                  <CheckCircle2 size={18} className="text-green-500 shrink-0 mt-0.5" />
                ) : (
                  <Circle size={18} className="text-gray-300 dark:text-gray-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${done ? "line-through text-gray-400" : "text-gray-900 dark:text-white"}`}>
                    {step.label}
                  </p>
                  {!done && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{step.desc}</p>}
                </div>
                {!done && (
                  <Link
                    href={step.href}
                    className="shrink-0 text-xs font-semibold text-orange-600 hover:text-orange-700 dark:text-orange-400 whitespace-nowrap"
                  >
                    {step.cta}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
