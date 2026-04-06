"use client";

import { useEffect, useState } from "react";
import { Sparkles, AlertCircle } from "lucide-react";
import Link from "next/link";

type BrandVoiceStatus = "loading" | "active" | "missing";

/**
 * Small indicator shown in the product editor sidebar.
 * Shows whether Brand Voice is configured and applied to AI outputs.
 */
export function BrandVoiceIndicator() {
  const [status, setStatus] = useState<BrandVoiceStatus>("loading");
  const [brandName, setBrandName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/brand-voice")
      .then(async (res) => {
        if (res.status === 404) {
          if (!cancelled) setStatus("missing");
          return;
        }
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        if (!cancelled) {
          const hasVoice = !!(data?.brandName?.trim() || data?.tone?.trim() || data?.targetAudience?.trim());
          setStatus(hasVoice ? "active" : "missing");
          if (data?.brandName?.trim()) setBrandName(data.brandName.trim());
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("missing");
      });
    return () => { cancelled = true; };
  }, []);

  if (status === "loading") return null;

  if (status === "active") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30">
        <Sparkles className="w-3.5 h-3.5 text-green-600 dark:text-green-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-green-700 dark:text-green-400">
            Brand Voice active
          </p>
          {brandName && (
            <p className="text-[10px] text-green-600/80 dark:text-green-500 truncate">{brandName}</p>
          )}
        </div>
        <Link
          href="/dashboard/brand-voice"
          className="text-[10px] text-green-600 dark:text-green-400 hover:underline shrink-0"
        >
          Edit
        </Link>
      </div>
    );
  }

  return (
    <Link
      href="/dashboard/brand-voice"
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors group"
    >
      <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
          Brand Voice not set
        </p>
        <p className="text-[10px] text-amber-600/80 dark:text-amber-500">
          AI uses generic tone — set yours for better copy
        </p>
      </div>
      <span className="text-[10px] text-amber-600 dark:text-amber-400 group-hover:underline shrink-0">
        Set up →
      </span>
    </Link>
  );
}
