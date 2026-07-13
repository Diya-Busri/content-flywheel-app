"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  Send, Sparkles, ClipboardCheck, Megaphone, ShoppingBag, TrendingUp,
} from "lucide-react";

const STEPS = [
  { icon: Send, label: "Submit Product" },
  { icon: Sparkles, label: "AI Builds Campaign" },
  { icon: ClipboardCheck, label: "Creator Reviews Assets" },
  { icon: Megaphone, label: "Featured on Social Media" },
  { icon: ShoppingBag, label: "Traffic Sent to Store" },
  { icon: TrendingUp, label: "Creator Growth" },
];

/** Minimal, mostly-visual explainer for what happens after a creator submits. */
export function CreatorJourney() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section ref={ref} className="py-16 lg:py-20 relative overflow-hidden">
      <div className="max-w-5xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-4">The creator journey</p>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
            From submission to growth.
          </h2>
        </motion.div>

        {/* Single row on every breakpoint — horizontal scroll on mobile — so the
            connecting line always lines up with every node, never wraps oddly. */}
        <div className="relative overflow-x-auto no-scrollbar -mx-6 px-6 sm:mx-0 sm:px-2">
          <div className="relative min-w-max sm:min-w-0 sm:grid sm:grid-cols-6 flex gap-x-8 sm:gap-x-2 gap-y-0">
            {/* base line */}
            <div className="absolute top-6 left-6 right-6 sm:left-2 sm:right-2 h-px bg-white/[0.08]" />

            {/* continuously sweeping progress dot */}
            <motion.div
              className="absolute top-6 w-2 h-2 -mt-1 rounded-full bg-orange-400"
              style={{ boxShadow: "0 0 8px 2px rgba(249,115,22,0.5)" }}
              animate={inView ? { left: ["4%", "96%"] } : {}}
              transition={{ duration: 3.2, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
            />

            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                  className="flex flex-col items-center text-center w-20 sm:w-auto shrink-0"
                >
                  <div className="w-12 h-12 rounded-full border border-white/10 bg-[#111213] flex items-center justify-center mb-3 relative z-10 shrink-0">
                    <Icon className="w-5 h-5 text-orange-400" />
                  </div>
                  <span className="text-[11px] font-semibold text-white/50 leading-tight">
                    {step.label}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
