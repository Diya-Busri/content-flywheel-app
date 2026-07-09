"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

const ACCENT = "#F5C97A";

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.12 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

const card = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

const noMotion = {
  hidden: { opacity: 1, y: 0 },
  visible: { opacity: 1, y: 0 },
};

export function Hero() {
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion ? { duration: 0 } : undefined;
  const contentVariants = reduceMotion ? undefined : container;
  const itemVariants = reduceMotion ? noMotion : item;
  const cardVariants = reduceMotion ? noMotion : card;

  return (
    <section id="product" className="relative overflow-hidden">
      {/* Subtle gradient glow behind hero */}
      <div
        className="pointer-events-none absolute -top-40 right-0 h-[480px] w-[520px] rounded-full opacity-30 blur-[120px]"
        style={{ background: `radial-gradient(circle, ${ACCENT} 0%, transparent 70%)` }}
        aria-hidden
      />
      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-start gap-16 px-4 pt-24 pb-28 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:px-8 lg:pt-32 lg:pb-36">
        <motion.div
          className="lg:col-span-6"
          variants={contentVariants}
          initial="hidden"
          animate="visible"
          transition={transition}
        >
          <motion.p
            variants={itemVariants}
            className="text-xs font-semibold uppercase tracking-wider text-white/60"
          >
            Private beta, built for creators and founder-led teams
          </motion.p>

          <motion.h1
            variants={itemVariants}
            className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl"
          >
            Turn one idea into a week of{" "}
            <span
              className="whitespace-nowrap"
              style={{
                color: ACCENT,
                textShadow: `0 0 40px ${ACCENT}40`,
              }}
            >
              high‑signal content
            </span>
            .
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-white/70 sm:text-lg"
          >
            Capture insights, repurpose into platform-native posts, and ship on a
            consistent cadence, without spreadsheets or a content calendar you’ll
            abandon.
          </motion.p>

          <motion.div variants={itemVariants} className="mt-10">
            <Link
              href="#waitlist"
              className="inline-flex items-center gap-2 rounded-lg bg-[#F5C97A] px-6 py-3.5 text-sm font-semibold text-[#0B0B0F] transition-colors hover:bg-[#F7D79A]"
            >
              Join the waitlist <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </motion.div>

        <motion.div
          className="lg:col-span-6"
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          transition={transition}
        >
          <div className="rounded-2xl border border-white/15 bg-white/[0.03] shadow-2xl shadow-black/30 ring-1 ring-white/5">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <span className="text-sm font-semibold text-white/90">
                Product preview
              </span>
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-white/70">
                Draft
              </span>
            </div>
            <div className="space-y-6 px-5 py-6">
              <div>
                <p className="text-sm font-semibold text-white">
                  Founder note
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/70">
                  One insight. Three angles. A clear next step.
                </p>
              </div>
              <div className="border-l border-white/10 pl-5">
                <p className="text-xs font-medium text-white/55">Raw input</p>
                <p className="mt-2 text-sm text-white/75">
                  “We loved the product, but didn’t understand the first step.”
                </p>
                <p className="mt-4 text-xs font-medium text-white/55">Output</p>
                <p className="mt-2 text-sm text-white/75">
                  A platform-native post that explains the first step in one
                  minute.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
