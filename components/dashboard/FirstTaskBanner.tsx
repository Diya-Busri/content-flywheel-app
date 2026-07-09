"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, Sparkles, ArrowRight } from "lucide-react";

const DISMISSED_KEY = "cf_first_task_banner_dismissed";

type FirstTaskBannerProps = {
  hasProduct: boolean;
};

export function FirstTaskBanner({ hasProduct }: FirstTaskBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (hasProduct) return;
    try {
      const dismissed = localStorage.getItem(DISMISSED_KEY);
      if (!dismissed) setVisible(true);
    } catch {
      // localStorage unavailable
      setVisible(true);
    }
  }, [hasProduct]);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // ignore
    }
  };

  if (!visible) return null;

  return (
    <div className="relative mb-8 rounded-2xl overflow-hidden bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-white shadow-lg">
      {/* Dismiss */}
      <button
        type="button"
        onClick={dismiss}
        className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pr-8">
        {/* Icon */}
        <div className="w-12 h-12 shrink-0 rounded-xl bg-white/20 flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-white" />
        </div>

        {/* Copy */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-lg leading-snug">
            Create your first product — it takes 2 minutes
          </p>
          <p className="text-white/80 text-sm mt-0.5">
            Pick a topic, and AI will write the content, generate a cover, and draft your marketing copy.
          </p>
        </div>

        {/* CTA */}
        <Link
          href="/dashboard/digital-products/create"
          className="shrink-0 inline-flex items-center gap-2 bg-white text-amber-600 font-semibold px-5 py-2.5 rounded-xl hover:bg-amber-50 transition-colors text-sm"
        >
          Get started <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
