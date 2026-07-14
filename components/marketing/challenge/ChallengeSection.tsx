"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

const ASSETS = ["Research", "Hooks", "Carousels", "Video scripts", "Emails", "Launch plan"];

function FadeUp({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }} className={className}>
      {children}
    </motion.div>
  );
}

export function ChallengeSection() {
  return (
    <section id="challenge" className="py-24 lg:py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(249,115,22,0.06),transparent_65%)] pointer-events-none" aria-hidden="true" />

      <div className="max-w-3xl mx-auto px-6 text-center">
        <FadeUp>
          <h2 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
            🚀 The 100 Product Challenge
          </h2>
          <p className="mt-5 text-lg text-white/50 leading-relaxed max-w-2xl mx-auto">
            Every week I&apos;ll choose one digital product and build a complete marketing campaign around it using Content Flywheel. Everything is shared publicly so you can see exactly how the platform works on real products.
          </p>

          {/* Asset list */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
            {ASSETS.map((a) => (
              <span
                key={a}
                className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/70"
              >
                {a}
              </span>
            ))}
          </div>

          {/* CTAs */}
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/challenge/submit"
                className="press-feedback inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:shadow-xl hover:shadow-orange-500/35"
              >
                Submit Your Product
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 hover:bg-white/5 px-7 py-3.5 text-sm font-bold text-white transition-colors"
              >
                Start Marketing Free
              </Link>
            </motion.div>
          </div>

          <p className="mt-5 text-xs text-white/30">
            Submit today. If you&apos;re selected, we&apos;ll be in touch and your product could be featured next.
          </p>
        </FadeUp>
      </div>
    </section>
  );
}
