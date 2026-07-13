"use client";

import { motion } from "framer-motion";
import {
  Search, Sparkles, Layers, Video, Mail, CalendarDays, Rocket, BarChart3, Check,
} from "lucide-react";
import type { MarketingAsset, MarketingAssetType } from "@/lib/marketing-challenge";

const ICONS: Record<MarketingAssetType, React.ElementType> = {
  research: Search,
  hooks: Sparkles,
  carousel: Layers,
  video_script: Video,
  email: Mail,
  launch_plan: CalendarDays,
  published: Rocket,
  analytics: BarChart3,
};

/** Compact chip grid of generated assets — used inline on featured/episode cards. */
export function MarketingAssetsGrid({ assets, className = "" }: { assets: MarketingAsset[]; className?: string }) {
  return (
    <div className={`grid grid-cols-4 gap-2 ${className}`}>
      {assets.map((asset, i) => {
        const Icon = ICONS[asset.type];
        return (
          <motion.div
            key={asset.type}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05, duration: 0.4 }}
            className={`relative rounded-lg border p-2 flex flex-col items-center text-center overflow-hidden ${
              asset.done ? "border-green-500/25 bg-green-500/[0.06]" : "border-white/10 bg-white/[0.03]"
            }`}
          >
            {!asset.done && (
              <motion.div
                className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent"
                animate={{ x: ["-100%", "100%"] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "linear", delay: i * 0.15 }}
              />
              )}
            <div className="relative">
              {asset.done ? (
                <Check className="w-3.5 h-3.5 text-green-400 mb-1" />
              ) : (
                <Icon className="w-3.5 h-3.5 text-white/25 mb-1" />
              )}
              <p className={`text-[9px] font-semibold leading-tight ${asset.done ? "text-white/70" : "text-white/30"}`}>
                {asset.label}
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
