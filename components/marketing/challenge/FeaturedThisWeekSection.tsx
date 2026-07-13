"use client";

import { motion, useInView } from "framer-motion";
import { useMemo, useRef } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ChallengeEpisode } from "@/lib/marketing-challenge";
import { getNextFeatureDate } from "@/lib/marketing-challenge";
import { FeaturedCreatorCard } from "./FeaturedCreatorCard";
import { CountdownTimer } from "./CountdownTimer";

function FadeUp({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }} className={className}>
      {children}
    </motion.div>
  );
}

export function FeaturedThisWeekSection({ episode }: { episode: ChallengeEpisode }) {
  const nextFeatureDate = useMemo(() => getNextFeatureDate(), []);
  const isRevealed = Boolean(episode.featuredAt);
  const emptyRef = useRef(null);
  const emptyInView = useInView(emptyRef, { once: true, margin: "-60px" });

  return (
    <section className="py-24 lg:py-32 bg-white/[0.02] border-y border-white/[0.05] relative overflow-hidden">
      <div className="max-w-4xl mx-auto px-6">
        <FadeUp className="text-center mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-4">Featured this week</p>
          <h2 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
            {isRevealed ? "This week's featured creator" : "This week's spotlight is still open"}
          </h2>
        </FadeUp>

        <FadeUp delay={0.1}>
          {isRevealed ? (
            <FeaturedCreatorCard
              variant="hero"
              creatorName={episode.creatorName}
              creatorAvatar={episode.creatorAvatar}
              productName={episode.productName}
              productImage={episode.productImage}
              storeUrl={episode.storeUrl}
              stats={episode.stats}
            />
          ) : (
            <div ref={emptyRef} className="relative rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-8 lg:p-10 text-center overflow-hidden">
              <motion.div
                className="absolute inset-0 pointer-events-none"
                aria-hidden="true"
                animate={emptyInView ? { opacity: [0.4, 0.8, 0.4] } : {}}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                style={{ background: "radial-gradient(circle at 50% 30%, rgba(249,115,22,0.08), transparent 65%)" }}
              />
              <div className="relative">
                <div className="flex justify-center">
                  <CountdownTimer target={nextFeatureDate} label="Until the spotlight opens" />
                </div>

                <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="mt-8">
                  <Link
                    href="/challenge/submit"
                    className="press-feedback inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-400 px-6 py-3 text-sm font-bold text-white transition-colors"
                  >
                    Submit Your Product
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </motion.div>
              </div>
            </div>
          )}
        </FadeUp>

        {isRevealed && (
          <FadeUp delay={0.2} className="flex flex-col items-center mt-8">
            <CountdownTimer target={nextFeatureDate} label="Until the next featured creator" />
          </FadeUp>
        )}
      </div>
    </section>
  );
}
