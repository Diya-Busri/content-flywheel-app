"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  Package, Search, Sparkles, Layers, Video, Mail, CalendarDays, ArrowRight,
} from "lucide-react";
import { GeneratingReveal } from "./GeneratingReveal";

function FadeUp({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }} className={className}>
      {children}
    </motion.div>
  );
}

const OUTPUTS = [
  {
    icon: Search,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/15",
    title: "Research",
    lines: [
      "Audience: overwhelmed professionals, 27–42",
      "Top pain point: \"I keep hitting snooze and losing my morning\"",
      "Competitor gap: nobody targets busy parents specifically",
    ],
  },
  {
    icon: Sparkles,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/15",
    title: "Hooks",
    lines: [
      "\"If you're exhausted by 9am, you're doing mornings wrong\"",
      "\"I tried 27 morning routines. Only one actually worked\"",
      "\"Nobody tells you this about waking up early\"",
    ],
  },
  {
    icon: Layers,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/15",
    title: "Carousel",
    lines: [
      "Slide 1 · Hook: \"Your mornings are costing you your whole day\"",
      "Slides 2–5 · The 4-step framework",
      "Slide 6 · CTA: \"Full system → link in bio\"",
    ],
  },
  {
    icon: Video,
    color: "text-pink-400",
    bg: "bg-pink-500/10",
    border: "border-pink-500/15",
    title: "TikTok Script",
    lines: [
      "[Hook] \"POV: you finally have a morning routine that works\"",
      "[Body] Show the guide, walk through Day 1",
      "[CTA] \"Link in bio, £19 for the full 7-day system\"",
    ],
  },
  {
    icon: Mail,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/15",
    title: "Email",
    lines: [
      "Subject: \"Your mornings are about to change\"",
      "Subject: \"The 5-minute fix for chaotic mornings\"",
      "3-email launch sequence, fully drafted",
    ],
  },
  {
    icon: CalendarDays,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/15",
    title: "Launch Plan",
    lines: [
      "Day 1–2: Teaser hooks + carousel",
      "Day 3–5: TikTok scripts + email 1",
      "Day 6–7: Launch post + email 2–3",
    ],
  },
];

export function RealExampleSection() {
  return (
    <section id="how-it-works" className="py-24 lg:py-32 bg-white/[0.02] border-y border-white/[0.05] relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-6">
        <FadeUp className="text-center mb-16">
          <p className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-4">A real example</p>
          <h2 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
            Here&apos;s exactly what{" "}
            <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
              you&apos;ll get
            </span>
          </h2>
          <p className="mt-4 text-lg text-white/40 max-w-xl mx-auto">
            One product, run through Content Flywheel: research, competitor analysis, hooks, carousels, scripts, emails, social posts and landing page copy, all generated from a single product. No editing, no prompting back and forth.
          </p>
        </FadeUp>

        <div className="grid lg:grid-cols-[minmax(0,280px),1fr] gap-8 lg:gap-10 items-start">
          {/* Input card */}
          <FadeUp className="lg:sticky lg:top-24">
            <div className="rounded-2xl border border-white/10 bg-[#111213] p-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-4">Input</p>
              <div className="flex items-start gap-3">
                <div className="w-12 h-16 rounded-lg bg-gradient-to-br from-orange-500/30 to-amber-600/20 border border-orange-500/20 flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white leading-tight">7-Day Morning Routine Guide</p>
                  <p className="text-xs text-white/40 mt-1">PDF guide · £19</p>
                </div>
              </div>
              <div className="mt-5 pt-5 border-t border-white/[0.07] flex items-center gap-2 text-orange-400">
                <ArrowRight className="w-4 h-4 rotate-90 lg:rotate-0" />
                <span className="text-xs font-semibold">Runs through the flywheel</span>
              </div>
            </div>
          </FadeUp>

          {/* Outputs grid */}
          <div className="grid sm:grid-cols-2 gap-4">
            {OUTPUTS.map((o, i) => {
              const Icon = o.icon;
              return (
                <FadeUp key={o.title} delay={i * 0.08}>
                  <motion.div
                    whileHover={{ y: -2 }}
                    className={`h-full rounded-2xl border ${o.border} bg-white/[0.02] p-5 transition-colors hover:bg-white/[0.03]`}
                  >
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className={`relative w-8 h-8 rounded-lg ${o.bg} flex items-center justify-center shrink-0`}>
                        <Icon className={`w-4 h-4 ${o.color}`} />
                        <motion.span
                          aria-hidden="true"
                          className={`absolute -inset-0.5 rounded-lg border border-current opacity-0 ${o.color}`}
                          initial={{ opacity: 0 }}
                          whileInView={{ opacity: [0, 0.4, 0] }}
                          viewport={{ once: true }}
                          transition={{ duration: 1.2, delay: i * 0.08 }}
                        />
                      </div>
                      <p className="text-sm font-bold text-white">{o.title}</p>
                      <span className="ml-auto text-[9px] text-white/30 font-mono">generated</span>
                    </div>
                    <ul className="space-y-1.5">
                      {o.lines.map((line, li) => (
                        <li key={line}>
                          <GeneratingReveal delay={i * 0.08 + li * 0.15 + 0.15}>
                            <span className="text-[11px] text-white/45 leading-relaxed font-mono">{line}</span>
                          </GeneratingReveal>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                </FadeUp>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
