"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Check, Circle, ChevronDown, ChevronUp } from "lucide-react";
import type { OnboardingSteps } from "@/app/api/onboarding/route";

const ITEMS: { key: keyof OnboardingSteps; label: string; href: string }[] = [
  { key: "createAccount", label: "Create your account", href: "/dashboard" },
  { key: "brandProfile", label: "Set up brand profile", href: "/dashboard/settings#brand-profile" },
  { key: "firstProduct", label: "Create first digital product", href: "/dashboard/digital-products" },
  { key: "exploreDashboard", label: "Explore the dashboard", href: "/dashboard" },
  { key: "watchDemo", label: "Watch the demo video", href: "/dashboard" },
];

type OnboardingChecklistProps = {
  steps: OnboardingSteps | null;
};

export function OnboardingChecklist({ steps }: OnboardingChecklistProps) {
  const [collapsed, setCollapsed] = useState(false);

  const completed = ITEMS.filter((item) => steps?.[item.key] === true).length;
  const total = ITEMS.length;
  const allDone = completed >= total;

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
          {ITEMS.map(({ key, label, href }) => {
            const done = steps?.[key] === true;
            return (
              <li key={key}>
                <Link
                  href={href}
                  className="flex items-center gap-3 rounded-lg py-2 px-2 -mx-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
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
  );
}
