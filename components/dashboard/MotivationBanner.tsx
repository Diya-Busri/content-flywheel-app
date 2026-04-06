"use client";

import { useState } from "react";
import { Zap } from "lucide-react";
import { CreateVideoModal } from "./CreateVideoModal";

type MotivationBannerProps = {
  productsCount: number;
  videosCount: number;
};

function getMessage(products: number, videos: number): { headline: string; sub: string } {
  if (products === 0 && videos === 0) {
    return {
      headline: "Your first product is one click away.",
      sub: "Create it now and turn it into a sales video today — don't wait.",
    };
  }
  if (products > 0 && videos === 0) {
    return {
      headline: `You have ${products} product${products > 1 ? "s" : ""} with no videos. That's lost sales.`,
      sub: "Create a video for your best product right now and start promoting it today.",
    };
  }
  if (products >= 10) {
    return {
      headline: `${products} products created — now turn them into sales.`,
      sub: "Create a video for each product and post daily. The creators who post win.",
    };
  }
  if (products >= 5) {
    return {
      headline: `You've created ${products} products — now turn them into sales.`,
      sub: "Create a video for each product today and start sharing your links.",
    };
  }
  if (videos > 0 && products > 0) {
    return {
      headline: `${products} product${products > 1 ? "s" : ""}, ${videos} video${videos > 1 ? "s" : ""} — keep pushing.`,
      sub: "Post one more video today. The algorithm rewards creators who show up every day.",
    };
  }
  return {
    headline: "Every day you don't post is a day your competitors do.",
    sub: "Create 1 video right now — it takes less than 10 minutes.",
  };
}

export function MotivationBanner({ productsCount, videosCount }: MotivationBannerProps) {
  const { headline, sub } = getMessage(productsCount, videosCount);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className="rounded-xl bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/40 px-5 py-4 mb-8 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <Zap className="w-4 h-4 text-orange-500" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white text-sm leading-snug">
              {headline}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
              {sub}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="shrink-0 inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <Zap className="w-3.5 h-3.5" />
          Create Video Now
        </button>
      </div>

      <CreateVideoModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
