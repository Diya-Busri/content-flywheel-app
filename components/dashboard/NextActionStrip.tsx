"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { CreateVideoModal } from "./CreateVideoModal";

type NextActionStripProps = {
  productsCount: number;
  videosCount: number;
};

function getNextAction(products: number, videos: number): string {
  if (products === 0) return "Create your first product to start getting traffic.";
  if (videos === 0) return `You have ${products} product${products > 1 ? "s" : ""} — create a video to start promoting.`;
  if (products > videos) return `You have ${products - videos} product${products - videos > 1 ? "s" : ""} without a video — promote them now.`;
  return `You have ${products} product${products > 1 ? "s" : ""} — create more videos to grow faster.`;
}

export function NextActionStrip({ productsCount, videosCount }: NextActionStripProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className="rounded-xl bg-white dark:bg-[#1A1A1A] border-2 border-orange-400 dark:border-orange-500/60 px-6 py-5 mb-8 flex items-center justify-between gap-4 flex-wrap shadow-sm">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-orange-500 uppercase tracking-wide mb-1">
            Your next step
          </p>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {getNextAction(productsCount, videosCount)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="shrink-0 inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-base font-bold px-6 py-3 rounded-xl transition-all shadow-[0_0_16px_rgba(249,115,22,0.45)] hover:shadow-[0_0_22px_rgba(249,115,22,0.6)]"
        >
          Create Your Next Video
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <CreateVideoModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
