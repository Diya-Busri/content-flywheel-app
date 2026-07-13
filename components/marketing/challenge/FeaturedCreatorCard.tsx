"use client";

import { motion } from "framer-motion";
import { Sparkles, Store, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { CreatorStat } from "@/lib/marketing-challenge";

export interface FeaturedCreatorCardProps {
  creatorName: string;
  creatorAvatar: string;
  productName: string;
  productImage: string;
  storeUrl: string | null;
  variant?: "compact" | "hero";
  badgeLabel?: string;
  /** Optional — renders a small stats row once real creator data exists. */
  stats?: CreatorStat[];
  className?: string;
}

export function FeaturedCreatorCard({
  creatorName,
  creatorAvatar,
  productName,
  productImage,
  storeUrl,
  variant = "compact",
  badgeLabel = "Featured by Content Flywheel",
  stats,
  className = "",
}: FeaturedCreatorCardProps) {
  const isHero = variant === "hero";

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      className={`relative rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden ${
        isHero ? "p-8 lg:p-10" : "p-5"
      } ${className}`}
    >
      {/* Animated gradient glow — purely decorative, starts once visible */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-24 opacity-40"
        style={{
          background:
            "conic-gradient(from 0deg, rgba(249,115,22,0.25), transparent 30%, transparent 70%, rgba(249,115,22,0.25))",
        }}
        initial={{ rotate: 0 }}
        whileInView={{ rotate: 360 }}
        viewport={{ once: true }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
      />
      <div className="relative">
        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-[10px] font-bold text-orange-400 mb-5">
          <Sparkles className="w-3 h-3" />
          {badgeLabel}
        </div>

        <div className={`flex ${isHero ? "flex-col sm:flex-row sm:items-center" : "items-center"} gap-5`}>
          {/* Product cover */}
          <div
            className={`shrink-0 rounded-2xl bg-gradient-to-br from-orange-500/25 to-amber-600/15 border border-orange-500/20 flex items-center justify-center ${
              isHero ? "w-24 h-32" : "w-14 h-18"
            }`}
          >
            <span className={isHero ? "text-4xl" : "text-2xl"}>{productImage}</span>
          </div>

          <div className="min-w-0">
            <p className={`font-extrabold text-white leading-tight ${isHero ? "text-xl lg:text-2xl" : "text-sm"}`}>
              {productName}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs shrink-0">
                {creatorAvatar}
              </div>
              <span className={`text-white/50 ${isHero ? "text-sm" : "text-xs"}`}>{creatorName}</span>
            </div>
          </div>
        </div>

        {/* Store CTA */}
        <div className={isHero ? "mt-7" : "mt-5"}>
          {storeUrl ? (
            <Link
              href={storeUrl}
              className="press-feedback group inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-400 px-5 py-2.5 text-sm font-bold text-white transition-colors"
            >
              <Store className="w-4 h-4" />
              Visit store
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </Link>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-xl border border-dashed border-white/15 px-5 py-2.5 text-sm font-semibold text-white/35">
              <Store className="w-4 h-4" />
              Store opens when this episode airs
            </span>
          )}
        </div>

        {/* Stats row — only renders once real creator stats exist */}
        {isHero && stats && stats.length > 0 && (
          <div className="mt-7 pt-6 border-t border-white/[0.07] grid grid-cols-3 gap-3">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-lg font-extrabold text-white">{stat.value}</p>
                <p className="text-[10px] text-white/30 uppercase tracking-wide mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
