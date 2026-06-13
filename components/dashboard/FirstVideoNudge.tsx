"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { useOnboarding } from "@/components/onboarding/onboarding-provider";

const DISMISS_KEY = "cf_first_video_dismissed";

type Props = {
  /** Pass the totalVideos count fetched server-side so the nudge can hide immediately on mount. */
  totalVideos: number;
};

export function FirstVideoNudge({ totalVideos }: Props) {
  const { modalActive } = useOnboarding();
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") {
        setDismissed(true);
      }
    } catch {
      // localStorage not available (SSR safety)
    }
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  };

  // Only show when: mounted (client), not dismissed, and truly 0 videos
  if (!mounted || dismissed || totalVideos !== 0 || modalActive) return null;

  return (
    <section className="mb-10">
      <div
        className="relative rounded-xl overflow-hidden p-7 md:p-8"
        style={{
          background: "linear-gradient(135deg, #f97316 0%, #fb923c 40%, #fdba74 100%)",
        }}
      >
        {/* Dismiss button */}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute top-4 right-4 rounded-full p-1.5 bg-white/20 hover:bg-white/30 transition-colors text-white"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Headline */}
        <h2 className="text-xl md:text-2xl font-bold text-white mb-1">
          Ready to create your first video? 🎬
        </h2>
        <p className="text-orange-100 mb-6 text-sm md:text-base">
          It takes about 10 minutes. Pick a format to get started:
        </p>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/digital-products/create"
            className="inline-flex items-center rounded-lg bg-white text-orange-600 font-semibold text-sm px-4 py-2.5 hover:bg-orange-50 transition-colors shadow-sm"
          >
            Create a Digital Product
          </Link>
          <Link
            href="/dashboard/library"
            className="inline-flex items-center rounded-lg bg-orange-700/40 text-white font-semibold text-sm px-4 py-2.5 hover:bg-orange-700/60 transition-colors border border-white/30"
          >
            Browse Templates
          </Link>
        </div>
      </div>
    </section>
  );
}
