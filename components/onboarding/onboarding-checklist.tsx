"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Circle, ChevronDown, ChevronUp, Play } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { OnboardingSteps } from "@/app/api/onboarding/route";

type ChecklistItem = {
  key: keyof OnboardingSteps;
  label: string;
  href?: string;
  openDemoModal?: boolean;
};

const ITEMS: ChecklistItem[] = [
  { key: "createAccount", label: "Create your account", href: "/dashboard" },
  { key: "brandProfile", label: "Set up brand profile", href: "/dashboard/settings#brand-profile" },
  { key: "firstProduct", label: "Create first digital product", href: "/dashboard/digital-products" },
  { key: "exploreDashboard", label: "Explore the dashboard", href: "/dashboard" },
  { key: "watchDemo", label: "Watch the demo video", openDemoModal: true },
];

type OnboardingChecklistProps = {
  steps: OnboardingSteps | null;
  enabledFeatures?: string[] | null;
  onStepsChange?: () => void;
};

export function OnboardingChecklist({ steps, enabledFeatures, onStepsChange }: OnboardingChecklistProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [demoModalOpen, setDemoModalOpen] = useState(false);

  // Filter items based on what the user selected during onboarding.
  // If enabledFeatures is set and doesn't include "digital_products", hide the firstProduct step.
  const visibleItems = ITEMS.filter((item) => {
    if (item.key === "firstProduct" && enabledFeatures != null) {
      return enabledFeatures.includes("digital_products");
    }
    return true;
  });

  const completed = visibleItems.filter((item) => steps?.[item.key] === true).length;
  const total = visibleItems.length;
  const allDone = completed >= total;

  const handleCloseDemoModal = () => {
    setDemoModalOpen(false);
    fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steps: { ...steps, watchDemo: true } }),
    }).then(() => onStepsChange?.()).catch(() => {});
  };

  if (allDone) return null;

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/80">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="font-semibold text-slate-900 dark:text-white">
            Getting started
          </span>
          <span className="text-sm text-amber-600 dark:text-amber-400 font-medium">
            {completed}/{total} completed
          </span>
          {collapsed ? (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronUp className="h-4 w-4 text-slate-500" />
          )}
        </button>
        {!collapsed && (
          <ul className="mt-4 space-y-2">
            {visibleItems.map((item) => {
              const { key, label, href, openDemoModal } = item;
              const done = steps?.[key] === true;
              const baseClass = "flex items-center gap-3 rounded-lg py-2 px-2 -mx-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors w-full text-left";
              if (openDemoModal) {
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => setDemoModalOpen(true)}
                      className={baseClass}
                    >
                      {done ? (
                        <Check className="h-5 w-5 shrink-0 text-amber-500" />
                      ) : (
                        <Circle className="h-5 w-5 shrink-0 text-slate-300 dark:text-slate-600" />
                      )}
                      <span className={done ? "line-through opacity-70" : ""}>
                        {label}
                      </span>
                    </button>
                  </li>
                );
              }
              return (
                <li key={key}>
                  <Link href={href!} className={baseClass}>
                    {done ? (
                      <Check className="h-5 w-5 shrink-0 text-amber-500" />
                    ) : (
                      <Circle className="h-5 w-5 shrink-0 text-slate-300 dark:text-slate-600" />
                    )}
                    <span className={done ? "line-through opacity-70" : ""}>
                      {label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog open={demoModalOpen} onOpenChange={(open) => !open && handleCloseDemoModal()}>
        <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden border-slate-200 dark:border-slate-700 bg-slate-900">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="text-lg text-white">
              Demo video
            </DialogTitle>
          </DialogHeader>
          <div className="aspect-video w-full flex flex-col items-center justify-center gap-4 bg-slate-900 px-6 py-12 border-t border-slate-700/50">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-700/80 ring-2 ring-orange-500/40">
              <Play className="h-10 w-10 text-slate-500 fill-slate-500" strokeWidth={1.5} />
            </div>
            <p className="text-xl font-semibold text-white">
              Demo video coming soon
            </p>
            <p className="text-sm text-slate-400 text-center max-w-sm">
              We&apos;re putting together a walkthrough for you. Check back soon!
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
