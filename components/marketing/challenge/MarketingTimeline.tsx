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

/** Animated pipeline: Research → Hooks → Carousels → Video Scripts → Emails → Launch Calendar → Published → Analytics. */
export function MarketingTimeline({ assets, className = "" }: { assets: MarketingAsset[]; className?: string }) {
  const firstPendingIndex = assets.findIndex((a) => !a.done);

  return (
    <div className={`relative overflow-x-auto no-scrollbar ${className}`}>
      <div className="flex items-start min-w-max px-1 py-2">
        {assets.map((asset, i) => {
          const Icon = ICONS[asset.type];
          const isCurrent = i === firstPendingIndex;
          const isDone = asset.done;

          return (
            <div key={asset.type} className="flex items-start">
              {i > 0 && <Connector active={isDone || (firstPendingIndex !== -1 && i <= firstPendingIndex)} />}

              <div className="flex flex-col items-center w-16 sm:w-20 shrink-0">
                <div className="relative w-11 h-11 sm:w-12 sm:h-12">
                  {isCurrent && (
                    <motion.div
                      className="absolute -inset-1 rounded-full border-2 border-orange-400/60 border-t-transparent"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
                    />
                  )}
                  <div
                    className={`w-full h-full rounded-full border flex items-center justify-center ${
                      isDone
                        ? "bg-green-500/15 border-green-500/30"
                        : isCurrent
                        ? "bg-orange-500/15 border-orange-500/40"
                        : "bg-white/[0.03] border-white/10"
                    }`}
                  >
                    {isDone ? (
                      <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
                    ) : (
                      <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${isCurrent ? "text-orange-400" : "text-white/20"}`} />
                    )}
                  </div>
                </div>
                <span
                  className={`text-[9px] sm:text-[10px] font-semibold text-center mt-2 leading-tight ${
                    isDone ? "text-white/60" : isCurrent ? "text-orange-400" : "text-white/25"
                  }`}
                >
                  {asset.label}
                </span>
                {isCurrent && (
                  <span className="text-[8px] text-orange-400/70 mt-0.5 font-mono">generating…</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Connector({ active }: { active: boolean }) {
  return (
    <div className="relative w-6 sm:w-10 h-11 sm:h-12 shrink-0 flex items-center">
      <div className="w-full h-px bg-white/10 relative overflow-hidden">
        {active && (
          <motion.div
            className="absolute inset-y-0 w-4 bg-gradient-to-r from-transparent via-orange-400 to-transparent"
            animate={{ left: ["-20%", "120%"] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
          />
        )}
      </div>
    </div>
  );
}
