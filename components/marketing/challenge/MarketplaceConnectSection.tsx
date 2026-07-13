"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import Link from "next/link";
import { ArrowRight, ShoppingBag } from "lucide-react";
import type { ChallengeEpisode } from "@/lib/marketing-challenge";
import { EpisodeCard } from "./EpisodeCard";

function FadeUp({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }} className={className}>
      {children}
    </motion.div>
  );
}

export function MarketplaceConnectSection({
  featuredEpisode,
  previousEpisodes,
}: {
  featuredEpisode: ChallengeEpisode;
  previousEpisodes: ChallengeEpisode[];
}) {
  const revealedFeatured = featuredEpisode.featuredAt ? featuredEpisode : null;
  const revealedCards = revealedFeatured ? [revealedFeatured, ...previousEpisodes] : [];
  const ghostStart = revealedCards.length > 0 ? revealedCards.length + 1 : 1;

  return (
    <section id="marketplace-connect" className="py-24 lg:py-32 relative overflow-hidden">
      <div className="max-w-5xl mx-auto px-6">
        <FadeUp className="text-center mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-4">More creators to discover</p>
          <h2 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
            Discover creators{" "}
            <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
              we&apos;ve featured
            </span>
          </h2>
          <p className="mt-4 text-lg text-white/40 max-w-xl mx-auto">
            Every episode of the challenge adds a new creator and product to the marketplace.
          </p>
        </FadeUp>

        <FadeUp delay={0.1}>
          <div className="flex gap-4 overflow-x-auto pb-3 no-scrollbar">
            {revealedCards.map((ep, i) => (
              <EpisodeCard key={ep.episodeNumber} episode={ep} delay={i * 0.06} />
            ))}
            {[0, 1, 2].map((offset) => {
              const n = ghostStart + offset;
              return (
                <motion.div
                  key={n}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.5, delay: (revealedCards.length + offset) * 0.06 }}
                  className="shrink-0 w-40 rounded-xl border border-dashed border-white/10 bg-white/[0.01] p-4 flex flex-col items-center justify-center text-center"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3">Ep. {n}</span>
                  <div className="w-10 h-[3.25rem] rounded-lg border border-dashed border-white/10 flex items-center justify-center mb-3">
                    <span className="text-white/20 text-lg">?</span>
                  </div>
                  <p className="text-[10px] text-white/25">Awaiting a creator</p>
                </motion.div>
              );
            })}
          </div>
        </FadeUp>

        <FadeUp delay={0.2} className="text-center mt-12">
          <Link
            href="/marketplace"
            className="press-feedback group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-7 py-3.5 text-sm font-bold text-white transition hover:bg-white/10"
          >
            <ShoppingBag className="w-4 h-4 text-white/50" />
            Browse the Marketplace
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </FadeUp>
      </div>
    </section>
  );
}
