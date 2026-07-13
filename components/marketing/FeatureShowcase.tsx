"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  Search, PenLine, Video, Layers, Mail, Rocket, BarChart3, ArrowRight,
} from "lucide-react";
import Link from "next/link";

/* ─── helpers ─── */
function FadeUp({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 28 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }} className={className}>
      {children}
    </motion.div>
  );
}

interface Card {
  emoji: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  title: string;
  desc: string;
}

const CARDS: Card[] = [
  {
    emoji: "🔍",
    icon: Search,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "hover:border-cyan-500/30",
    title: "Research",
    desc: "AI studies your product, your audience, and your competitors before writing a single word.",
  },
  {
    emoji: "📝",
    icon: PenLine,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "hover:border-orange-500/30",
    title: "Content Ideas",
    desc: "Weeks of hooks, angles, and post ideas generated straight from your product.",
  },
  {
    emoji: "🎬",
    icon: Video,
    color: "text-pink-400",
    bg: "bg-pink-500/10",
    border: "hover:border-pink-500/30",
    title: "Video Scripts",
    desc: "TikTok and Reels scripts with hooks, beats, and captions ready to film.",
  },
  {
    emoji: "🎠",
    icon: Layers,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "hover:border-purple-500/30",
    title: "Carousels",
    desc: "Swipeable carousel decks for Instagram and LinkedIn, designed and written for you.",
  },
  {
    emoji: "📧",
    icon: Mail,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "hover:border-blue-500/30",
    title: "Email Campaigns",
    desc: "Launch sequences and nurture emails that turn your list into buyers.",
  },
  {
    emoji: "🚀",
    icon: Rocket,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "hover:border-amber-500/30",
    title: "Launch Strategy",
    desc: "A day-by-day plan for your launch window, so you know exactly what to post and when.",
  },
  {
    emoji: "📊",
    icon: BarChart3,
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "hover:border-green-500/30",
    title: "Analytics",
    desc: "See what's actually driving traffic and sales, and let AI double down on it.",
  },
];

export function FeatureShowcase() {
  return (
    <section id="features" className="py-24 lg:py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(249,115,22,0.03),transparent_60%)] pointer-events-none" aria-hidden="true" />

      <div className="max-w-6xl mx-auto px-6">
        <FadeUp className="text-center mb-16">
          <p className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-4">After you hit publish</p>
          <h2 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
            Everything you need{" "}
            <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
              after you create your product
            </span>
          </h2>
          <p className="mt-4 text-lg text-white/40 max-w-xl mx-auto">
            One dashboard covers research through launch, so your product never has to market itself.
          </p>
        </FadeUp>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {CARDS.map((card, i) => {
            const Icon = card.icon;
            return (
              <FadeUp key={card.title} delay={(i % 4) * 0.06}>
                <motion.div
                  whileHover={{ y: -3 }}
                  transition={{ duration: 0.2 }}
                  className={`h-full rounded-2xl border border-white/10 bg-white/[0.02] ${card.border} p-6 transition-colors`}
                >
                  <div className={`relative w-11 h-11 rounded-xl ${card.bg} flex items-center justify-center mb-4`}>
                    <motion.div
                      aria-hidden="true"
                      className={`absolute inset-0 rounded-xl ${card.bg}`}
                      initial={{ opacity: 0.5 }}
                      whileInView={{ opacity: [0.5, 1, 0.5] }}
                      viewport={{ once: true }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }}
                    />
                    <Icon className={`relative w-5 h-5 ${card.color}`} />
                  </div>
                  <p className="text-sm font-bold text-white mb-1.5">
                    <span className="mr-1.5">{card.emoji}</span>{card.title}
                  </p>
                  <p className="text-xs text-white/40 leading-relaxed">{card.desc}</p>
                </motion.div>
              </FadeUp>
            );
          })}

          {/* CTA card fills the grid */}
          <FadeUp delay={0.4}>
            <Link
              href="/signup"
              className="group h-full flex flex-col items-start justify-center rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-transparent p-6 transition-colors hover:border-orange-500/50"
            >
              <p className="text-sm font-bold text-white mb-1">See it on your product</p>
              <p className="text-xs text-white/40 leading-relaxed mb-4">Start free and get your first marketing campaign in minutes.</p>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-400">
                Start Marketing Free
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
          </FadeUp>
        </div>
      </div>
    </section>
  );
}
