"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/components/onboarding/onboarding-provider";

const DISMISS_KEY = "cf_getting_started_dismissed";
const COLLAPSE_KEY = "cf_getting_started_collapsed";

type Step = {
  id: string;
  label: string;
  description: string;
  href: string;
  done: boolean;
};

type Props = {
  hasBrandVoice: boolean;
  hasProduct: boolean;
  hasThumbnail: boolean;
  hasPromoVideo: boolean;
  hasSubscriber?: boolean;
  hasCampaign?: boolean;
};

export function GettingStartedChecklist({ hasBrandVoice, hasProduct, hasThumbnail, hasPromoVideo, hasSubscriber = false, hasCampaign = false }: Props) {
  const { modalActive } = useOnboarding();
  const [dismissed, setDismissed] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {}
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
  };

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0"); } catch {}
  };

  if (!mounted || dismissed || modalActive) return null;

  const steps: Step[] = [
    {
      id: "brand-voice",
      label: "Set your Brand Voice",
      description: "Tell the AI your brand name, niche, and tone so every output sounds like you.",
      href: "/dashboard/brand-voice",
      done: hasBrandVoice,
    },
    {
      id: "product",
      label: "Create your first product",
      description: "Generate a digital product — eBook, guide, template, or course outline.",
      href: "/dashboard/digital-products/create",
      done: hasProduct,
    },
    {
      id: "thumbnail",
      label: "Add a cover thumbnail",
      description: "Give your product a professional cover image that stands out on marketplaces.",
      href: "/dashboard/digital-products",
      done: hasThumbnail,
    },
    {
      id: "video",
      label: "Generate a promo video",
      description: "Create an AI avatar video to promote your product on TikTok and Instagram.",
      href: "/dashboard/digital-products",
      done: hasPromoVideo,
    },
    {
      id: "subscriber",
      label: "Add your first subscriber",
      description: "Build your list — share your subscribe page or import existing contacts.",
      href: "/dashboard/email-marketing",
      done: hasSubscriber,
    },
    {
      id: "campaign",
      label: "Send your first email campaign",
      description: "Reach your audience directly — announce a product, share a tip, or say hi.",
      href: "/dashboard/email-marketing",
      done: hasCampaign,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const percent = Math.round((doneCount / steps.length) * 100);
  const allDone = doneCount === steps.length;

  return (
    <section className="mb-10 rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50/60 dark:border-orange-900/40 dark:from-orange-950/20 dark:to-amber-950/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <button type="button" className="flex items-center gap-3 flex-1 text-left" onClick={toggleCollapse}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <p className="font-semibold text-gray-900 dark:text-white text-sm">
                {allDone ? "🎉 You're all set!" : "Getting Started"}
              </p>
              <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
                {doneCount}/{steps.length} complete
              </span>
            </div>
            {/* Progress bar */}
            <div className="mt-2 h-1.5 bg-orange-100 dark:bg-orange-900/30 rounded-full overflow-hidden w-48">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${percent}%`,
                  background: allDone ? "#22c55e" : "#f97316",
                }}
              />
            </div>
          </div>
          {collapsed ? (
            <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
          ) : (
            <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
          )}
        </button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 ml-2 shrink-0 text-gray-400 hover:text-gray-600"
          onClick={dismiss}
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Steps */}
      {!collapsed && (
        <ul className="border-t border-orange-100 dark:border-orange-900/30 divide-y divide-orange-100 dark:divide-orange-900/20">
          {steps.map((step) => (
            <li key={step.id}>
              <Link
                href={step.done ? "#" : step.href}
                className={`flex items-start gap-3 px-5 py-3 transition-colors ${
                  step.done
                    ? "cursor-default"
                    : "hover:bg-orange-100/50 dark:hover:bg-orange-900/20"
                }`}
                onClick={(e) => step.done && e.preventDefault()}
              >
                <div className="mt-0.5 shrink-0">
                  {step.done ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <Circle className="w-5 h-5 text-orange-300 dark:text-orange-700" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${step.done ? "line-through text-gray-400 dark:text-gray-600" : "text-gray-900 dark:text-white"}`}>
                    {step.label}
                  </p>
                  {!step.done && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{step.description}</p>
                  )}
                </div>
                {!step.done && (
                  <span className="text-xs font-medium text-orange-500 dark:text-orange-400 shrink-0 mt-0.5">
                    Start →
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
