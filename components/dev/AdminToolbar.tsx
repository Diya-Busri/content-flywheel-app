"use client";

/**
 * AdminToolbar — admin-only controls surfaced in the sidebar header.
 * Houses developer/testing tools so they don't clutter page content.
 * Easily extended: add new tools here (Feature Flags, Cache Refresh, etc.)
 */

import { useState } from "react";
import { FlaskConical, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";

interface AdminToolbarProps {
  isAdmin?: boolean;
}

export function AdminToolbar({ isAdmin }: AdminToolbarProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  if (!isAdmin) return null;

  const reset = async () => {
    setBusy("reset");
    try {
      await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset: true }),
      });
      window.location.reload();
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    setBusy("restore");
    try {
      await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          steps: {
            modalDismissed: true,
            createAccount: true,
            brandProfile: true,
            firstProduct: true,
            exploreDashboard: true,
            watchDemo: true,
          },
          onboardingCompleted: true,
        }),
      });
      window.location.reload();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-3 mb-4">
      {/* Collapsed: single "Admin" pill that expands */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-500/10 border border-purple-200/60 dark:border-purple-500/20 text-purple-700 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px]">🛡️</span>
          <span className="text-[11px] font-semibold hidden md:block truncate">Admin Tools</span>
        </div>
        <span className="hidden md:block shrink-0">
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </span>
      </button>

      {open && (
        <div className="mt-1.5 flex flex-col gap-1">
          {/* Test Wizard — resets onboarding to step 0 */}
          <button
            type="button"
            onClick={reset}
            disabled={busy === "reset"}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-[11px] font-semibold transition-colors w-full"
            title="Reset onboarding to step 0 (Test Wizard)"
          >
            <FlaskConical size={12} className="shrink-0" />
            <span className="hidden md:block">{busy === "reset" ? "Resetting…" : "Test Wizard"}</span>
          </button>

          {/* Restore — marks all onboarding steps complete */}
          <button
            type="button"
            onClick={restore}
            disabled={busy === "restore"}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-700 disabled:opacity-60 text-white text-[11px] font-semibold transition-colors w-full"
            title="Restore: mark all onboarding steps complete"
          >
            <RotateCcw size={12} className="shrink-0" />
            <span className="hidden md:block">{busy === "restore" ? "Restoring…" : "Restore"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
