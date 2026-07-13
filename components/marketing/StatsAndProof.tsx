"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

/* ─── helpers ─── */
function FadeUp({ children, delay = 0, className = "" }: {
  children: React.ReactNode; delay?: number; className?: string;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── Beta trust cards ─── */
const BETA_CARDS = [
  {
    emoji: "🚀",
    title: "Early Access",
    desc: "Join before public launch and help shape the product. Your feedback directly influences what gets built next.",
    border: "border-orange-500/20",
    bg: "bg-orange-500/[0.04]",
    glow: "hover:border-orange-500/40",
  },
  {
    emoji: "💬",
    title: "Direct Founder Feedback",
    desc: "Every piece of feedback is reviewed personally. If something doesn't work, we want to know and we'll fix it.",
    border: "border-blue-500/20",
    bg: "bg-blue-500/[0.04]",
    glow: "hover:border-blue-500/40",
  },
  {
    emoji: "⚡",
    title: "Weekly Improvements",
    desc: "New features, fixes and improvements are shipped regularly throughout the beta. The product improves every week.",
    border: "border-purple-500/20",
    bg: "bg-purple-500/[0.04]",
    glow: "hover:border-purple-500/40",
  },
];

/* ─── Main export ─── */
export function StatsAndProof() {
  return (
    <section className="py-24 lg:py-32 border-t border-white/[0.05] bg-white/[0.01]">
      <div className="max-w-5xl mx-auto px-6">

        {/* Heading */}
        <FadeUp className="text-center mb-14">
          <p className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-4">Beta programme</p>
          <h2 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
            Built with our{" "}
            <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
              first creators
            </span>
          </h2>
          <p className="mt-5 text-lg text-white/45 max-w-2xl mx-auto leading-relaxed">
            Content Flywheel is currently in beta. We&apos;re working closely with our first creators to improve every part of the platform based on real feedback.
          </p>
        </FadeUp>

        {/* Three cards */}
        <div className="grid sm:grid-cols-3 gap-5 mb-14">
          {BETA_CARDS.map((card, i) => (
            <FadeUp key={card.title} delay={i * 0.1}>
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2 }}
                className={`relative rounded-2xl border ${card.border} ${card.bg} ${card.glow} p-7 h-full transition-colors overflow-hidden`}
              >
                {/* Subtle top glow line */}
                <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                <div className="text-3xl mb-5 select-none">{card.emoji}</div>
                <h3 className="text-base font-bold text-white mb-2">{card.title}</h3>
                <p className="text-sm text-white/45 leading-relaxed">{card.desc}</p>
              </motion.div>
            </FadeUp>
          ))}
        </div>

        {/* CTA */}
        <FadeUp delay={0.3} className="text-center">
          <Link
            href="/signup"
            className="press-feedback group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-9 py-4 text-base font-bold text-white shadow-lg shadow-orange-500/25 transition hover:shadow-xl hover:shadow-orange-500/35 hover:scale-105"
          >
            Start Marketing Free
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </Link>
          <p className="mt-3 text-sm text-white/30">
            Become one of the first creators using Content Flywheel.
          </p>
        </FadeUp>

      </div>
    </section>
  );
}
