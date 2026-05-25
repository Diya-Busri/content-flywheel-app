"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Circle, ChevronDown, ChevronUp } from "lucide-react";
import type { OnboardingSteps } from "@/app/api/onboarding/route";

type ChecklistItem = {
  key: keyof OnboardingSteps;
  label: string;
  href: string;
  external?: boolean;
};

const ITEMS: ChecklistItem[] = [
  { key: "createAccount", label: "Create your account", href: "/dashboard" },
  { key: "brandProfile", label: "Set up brand profile", href: "/dashboard/settings#brand-profile" },
  { key: "firstProduct", label: "Create first digital product", href: "/dashboard/digital-products/create" },
  { key: "exploreDashboard", label: "Set up your bio page", href: "/dashboard/bio-page" },
  { key: "watchDemo", label: "Connect Stripe payments", href: "/dashboard/settings" },
];

type OnboardingChecklistProps = {
  steps: OnboardingSteps | null;
  enabledFeatures?: string[] | null;
  onStepsChange?: () => void;
};

export function OnboardingChecklist({ steps, enabledFeatures, onStepsChange }: OnboardingChecklistProps) {
  const [collapsed, setCollapsed] = useState(false);

  const visibleItems = ITEMS.filter((item) => {
    if (item.key === "firstProduct" && enabledFeatures != null) {
      return enabledFeatures.includes("digital_products");
    }
    return true;
  });

  const completed = visibleItems.filter((item) => steps?.[item.key] === true).length;
  const total = visibleItems.length;
  const allDone = completed >= total;

  const markStepDone = (key: keyof OnboardingSteps) => {
    if (steps?.[key]) return;
    fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steps: { ...steps, [key]: true } }),
    }).then(() => onStepsChange?.()).catch(() => {});
  };

  if (allDone) return null;

  return (
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
            const { key, label, href, external } = item;
            const done = steps?.[key] === true;
            const baseClass = "flex items-center gap-3 rounded-lg py-2 px-2 -mx-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors w-full text-left";
            const icon = done
              ? <Check className="h-5 w-5 shrink-0 text-amber-500" />
              : <Circle className="h-5 w-5 shrink-0 text-slate-300 dark:text-slate-600" />;
            const text = <span className={done ? "line-through opacity-70" : ""}>{label}</span>;

            if (external) {
              return (
                <li key={key}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={baseClass}
                    onClick={() => markStepDone(key)}
                  >
                    {icon}{text}
                  </a>
                </li>
              );
            }
            return (
              <li key={key}>
                <Link href={href} className={baseClass}>
                  {icon}{text}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
