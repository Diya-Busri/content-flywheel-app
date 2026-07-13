"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import Link from "next/link";
import { ArrowRight, PlayCircle, Radar } from "lucide-react";
import type { ChallengeEpisode } from "@/lib/marketing-challenge";
import { FeaturedCreatorCard } from "./FeaturedCreatorCard";
import { MarketingTimeline } from "./MarketingTimeline";
import { StatusBadge } from "./StatusBadge";

function FadeUp({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }} className={className}>
      {children}
    </motion.div>
  );
}

export function ChallengeSection({
  episode,
  hasPreviousEpisodes,
}: {
  episode: ChallengeEpisode;
  hasPreviousEpisodes: boolean;
}) {
  const isRevealed = Boolean(episode.featuredAt);

  return (
    <section id="challenge" className="py-24 lg:py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(249,115,22,0.06),transparent_65%)] pointer-events-none" aria-hidden="true" />

      <div className="max-w-5xl mx-auto px-6">
        <FadeUp className="text-center mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1.5 text-xs font-bold text-orange-400 mb-6">
            🚀 Marketing 100 Digital Products
          </div>
          <h2 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
            Every week, one product becomes
            <br />
            <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
              a full campaign, live.
            </span>
          </h2>
          <p className="mt-4 text-lg text-white/40 max-w-xl mx-auto">
            Every eligible submission joins the production queue — every week, one of them becomes a complete AI marketing campaign, live.
          </p>
        </FadeUp>

        <FadeUp delay={0.1}>
          <div className="relative rounded-3xl border border-white/10 bg-white/[0.02] p-6 sm:p-8 lg:p-10">
            {/* Episode counter + status */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-white">Episode {episode.episodeNumber}</span>
                <span className="text-sm text-white/30 font-semibold">/ {episode.totalEpisodes}</span>
              </div>
              <StatusBadge status={episode.status} />
            </div>

            {isRevealed ? (
              <div className="grid lg:grid-cols-[minmax(0,320px),1fr] gap-8 items-start">
                <FeaturedCreatorCard
                  creatorName={episode.creatorName}
                  creatorAvatar={episode.creatorAvatar}
                  productName={episode.productName}
                  productImage={episode.productImage}
                  storeUrl={episode.storeUrl}
                  stats={episode.stats}
                />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-4">
                    The engine at work
                  </p>
                  <MarketingTimeline assets={episode.generatedAssets} />
                </div>
              </div>
            ) : (
              <LaunchTeaser episodeNumber={episode.episodeNumber} />
            )}

            {/* Buttons */}
            <div className="mt-10 pt-8 border-t border-white/[0.07] flex flex-col sm:flex-row gap-4 justify-center">
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Link
                  href="/challenge/submit"
                  className="press-feedback inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:shadow-xl hover:shadow-orange-500/35"
                >
                  Submit Your Product
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>

              {hasPreviousEpisodes ? (
                <motion.a
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  href="#marketplace-connect"
                  className="press-feedback inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 hover:bg-white/5 px-7 py-3.5 text-sm font-bold text-white transition-colors"
                >
                  <PlayCircle className="h-4 w-4 text-white/50" />
                  Watch Previous Episodes
                </motion.a>
              ) : (
                <span
                  title="Episode 1 hasn't aired yet"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 px-7 py-3.5 text-sm font-semibold text-white/30 cursor-default"
                >
                  <PlayCircle className="h-4 w-4" />
                  Watch Previous Episodes — coming soon
                </span>
              )}
            </div>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}

/** Honest, premium empty state for when no creator has been revealed yet. No fabricated social proof. */
function LaunchTeaser({ episodeNumber }: { episodeNumber: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <div
      ref={ref}
      className="relative rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-12 flex flex-col items-center justify-center text-center overflow-hidden"
    >
      <motion.div
        className="absolute inset-0"
        aria-hidden="true"
        animate={inView ? {
          background: [
            "radial-gradient(circle at 50% 50%, rgba(249,115,22,0.08), transparent 70%)",
            "radial-gradient(circle at 50% 50%, rgba(249,115,22,0.16), transparent 70%)",
            "radial-gradient(circle at 50% 50%, rgba(249,115,22,0.08), transparent 70%)",
          ],
        } : {}}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="relative">
        <motion.div
          animate={inView ? { rotate: 360 } : {}}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 rounded-full bg-orange-500/10 border border-orange-500/25 flex items-center justify-center mx-auto mb-5"
          aria-hidden="true"
        >
          <Radar className="w-5 h-5 text-orange-400" />
        </motion.div>
        <p className="text-lg font-extrabold text-white leading-tight">
          🚀 Episode {episodeNumber} launches soon
        </p>
        <p className="text-sm text-white/50 mt-3 leading-relaxed max-w-sm mx-auto">
          The first creator will be revealed shortly. Submit your product — every eligible submission joins the production queue and is featured once it&apos;s ready.
        </p>
      </div>
    </div>
  );
}
