"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Package, Users, FileX, TrendingDown, ArrowDown } from "lucide-react";

const STEPS = [
  {
    icon: Package,
    title: "Product built",
    desc: "You built something people actually need. That part's done.",
    tone: "neutral",
  },
  {
    icon: Users,
    title: "No audience",
    desc: "Nobody knows it exists yet.",
    tone: "bad",
  },
  {
    icon: FileX,
    title: "No content",
    desc: "No hooks, no posts, no plan to get in front of people.",
    tone: "bad",
  },
  {
    icon: TrendingDown,
    title: "No sales",
    desc: "The product sits there. Days turn into months.",
    tone: "bad",
  },
];

export function ProblemSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="py-24 lg:py-32 relative overflow-hidden">
      <div className="max-w-4xl mx-auto px-6">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-white/30 mb-4">The real problem</p>
          <h2 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
            Creating isn&apos;t the hard part anymore.
            <br />
            <span className="bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
              Marketing is.
            </span>
          </h2>
        </motion.div>

        <div className="flex flex-col items-center gap-3">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const bad = step.tone === "bad";
            return (
              <div key={step.title} className="flex flex-col items-center gap-3 w-full max-w-sm">
                {i > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.4, delay: i * 0.15 }}
                  >
                    <ArrowDown className="w-5 h-5 text-white/15" />
                  </motion.div>
                )}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={inView ? { opacity: 1, scale: 1 } : {}}
                  transition={{ duration: 0.5, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] }}
                  className={`w-full flex items-center gap-4 rounded-2xl border px-6 py-4 ${
                    bad
                      ? "border-red-500/20 bg-red-500/[0.04]"
                      : "border-white/10 bg-white/[0.03]"
                  }`}
                >
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                      bad ? "bg-red-500/10 text-red-400" : "bg-orange-500/15 text-orange-400"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className={`text-sm font-bold ${bad ? "text-white/70" : "text-white"}`}>{step.title}</p>
                    <p className="text-xs text-white/35 mt-0.5">{step.desc}</p>
                  </div>
                </motion.div>
              </div>
            );
          })}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.9 }}
          className="mt-14 text-center text-lg text-white/50 max-w-xl mx-auto"
        >
          Most creators stop right here. Not because the product is bad, but because marketing it is a full-time job nobody has time for.
        </motion.p>
      </div>
    </section>
  );
}
