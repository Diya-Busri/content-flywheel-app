"use client";

import { motion } from "framer-motion";
import type { ChallengeEpisode } from "@/lib/marketing-challenge";
import { StatusBadge } from "./StatusBadge";

export function EpisodeCard({ episode, delay = 0 }: { episode: ChallengeEpisode; delay?: number }) {
  const isEmpty = episode.status === "coming_soon" && !episode.featuredAt;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -2 }}
      className="shrink-0 w-40 rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:border-orange-500/30 transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/25">
          Ep. {episode.episodeNumber}
        </span>
        <StatusBadge status={episode.status} size="xs" />
      </div>
      <div
        className={`w-10 h-[3.25rem] mx-auto rounded-lg flex items-center justify-center mb-3 ${
          isEmpty ? "bg-white/[0.04] border border-dashed border-white/10" : "bg-gradient-to-br from-orange-500/25 to-amber-600/15 border border-orange-500/20"
        }`}
      >
        <span className="text-lg">{episode.productImage}</span>
      </div>
      <p className={`text-xs font-semibold text-center leading-tight ${isEmpty ? "text-white/30" : "text-white/70"}`}>
        {episode.productName}
      </p>
      <p className="text-[10px] text-white/30 text-center mt-1 truncate">{episode.creatorName}</p>
    </motion.div>
  );
}
