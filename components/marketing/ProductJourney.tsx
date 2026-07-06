"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  Lightbulb, Sparkles, PenLine, Store, Megaphone,
  DollarSign, BarChart3, ArrowRight,
} from "lucide-react";

const STEPS = [
  {
    icon: Lightbulb,
    emoji: "💡",
    label: "Idea",
    title: "You have an idea",
    desc: "A topic, a skill, a problem you can solve",
    color: "from-amber-500/20 to-amber-600/10",
    border: "border-amber-500/30",
    iconColor: "text-amber-400",
    iconBg: "bg-amber-500/15",
    preview: (
      <div className="space-y-1.5 mt-3">
        {["7-Day Morning Routine", "Notion Finance Tracker", "Instagram Caption Pack"].map((t, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400/60" />
            <span className="text-[10px] text-white/40">{t}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: Sparkles,
    emoji: "🤖",
    label: "AI Creates",
    title: "AI builds it in seconds",
    desc: "Ebook, planner, guide, or template — formatted and designed",
    color: "from-orange-500/20 to-orange-600/10",
    border: "border-orange-500/40",
    iconColor: "text-orange-400",
    iconBg: "bg-orange-500/15",
    preview: (
      <div className="mt-3 space-y-1">
        <div className="h-1.5 rounded bg-orange-500/40 w-full" />
        <div className="h-1.5 rounded bg-orange-500/25 w-3/4" />
        <div className="h-1.5 rounded bg-orange-500/15 w-5/6" />
        <div className="text-[9px] text-orange-400/70 mt-1.5 font-mono">Writing chapter 3...</div>
      </div>
    ),
  },
  {
    icon: PenLine,
    emoji: "✏️",
    label: "Edit & Design",
    title: "Customise your product",
    desc: "Edit, add your branding, tweak the design",
    color: "from-purple-500/20 to-purple-600/10",
    border: "border-purple-500/30",
    iconColor: "text-purple-400",
    iconBg: "bg-purple-500/15",
    preview: (
      <div className="mt-3 flex gap-1.5">
        {["#FF6B35", "#9B59B6", "#3498DB", "#2ECC71"].map((c) => (
          <div key={c} className="w-5 h-5 rounded-md ring-1 ring-white/10" style={{ backgroundColor: c + "80" }} />
        ))}
        <div className="w-5 h-5 rounded-md ring-2 ring-white/30 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-white/40" />
        </div>
      </div>
    ),
  },
  {
    icon: Store,
    emoji: "🏪",
    label: "Publish Store",
    title: "List on your store",
    desc: "Your branded storefront — no third-party platform",
    color: "from-blue-500/20 to-blue-600/10",
    border: "border-blue-500/30",
    iconColor: "text-blue-400",
    iconBg: "bg-blue-500/15",
    preview: (
      <div className="mt-3 rounded-lg border border-blue-500/20 bg-blue-500/5 px-2.5 py-2">
        <div className="text-[9px] font-bold text-white/50">yourstore.contentflywheel.co.uk</div>
        <div className="flex items-center gap-1.5 mt-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
          <span className="text-[9px] text-green-400 font-semibold">Live</span>
        </div>
      </div>
    ),
  },
  {
    icon: Megaphone,
    emoji: "📣",
    label: "Market",
    title: "Create promo content",
    desc: "AI video scripts, captions, hooks, and content plans",
    color: "from-pink-500/20 to-pink-600/10",
    border: "border-pink-500/30",
    iconColor: "text-pink-400",
    iconBg: "bg-pink-500/15",
    preview: (
      <div className="mt-3 space-y-1.5">
        {["TikTok hook ✓", "Instagram caption ✓", "Email sequence ✓"].map((t, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-pink-500/20 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-pink-400" />
            </div>
            <span className="text-[10px] text-white/40">{t}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: DollarSign,
    emoji: "💰",
    label: "Sell",
    title: "Sales come in",
    desc: "Stripe payments, auto delivery, discount codes",
    color: "from-green-500/20 to-green-600/10",
    border: "border-green-500/40",
    iconColor: "text-green-400",
    iconBg: "bg-green-500/15",
    preview: (
      <div className="mt-3 space-y-1">
        {[
          { name: "Sarah M.", amount: "£27" },
          { name: "Jake R.", amount: "£27" },
          { name: "Emma L.", amount: "£27" },
        ].map((s, i) => (
          <div key={i} className="flex items-center justify-between text-[9px]">
            <span className="text-white/30">{s.name}</span>
            <span className="text-green-400 font-bold">{s.amount}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: BarChart3,
    emoji: "📊",
    label: "Analytics",
    title: "Track & optimise",
    desc: "Revenue, conversions, top products, and growth",
    color: "from-cyan-500/20 to-cyan-600/10",
    border: "border-cyan-500/30",
    iconColor: "text-cyan-400",
    iconBg: "bg-cyan-500/15",
    preview: (
      <div className="mt-3 flex items-end gap-1 h-8">
        {[30, 50, 40, 70, 60, 90, 80].map((h, i) => (
          <div key={i} className="flex-1 rounded-sm bg-cyan-500/40" style={{ height: `${h}%` }} />
        ))}
      </div>
    ),
  },
];

function StepCard({ step, index, total }: { step: typeof STEPS[0]; index: number; total: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const Icon = step.icon;

  return (
    <div ref={ref} className="relative flex flex-col items-center">
      {/* Connecting line (hidden for last) */}
      {index < total - 1 && (
        <div className="hidden lg:flex absolute top-[52px] left-[calc(50%+44px)] right-0 items-center pointer-events-none" style={{ width: "calc(100% - 0px)", zIndex: 0 }}>
          <motion.div
            initial={{ scaleX: 0 }}
            animate={inView ? { scaleX: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
            style={{ originX: 0 }}
            className="h-px bg-gradient-to-r from-white/20 to-white/5 w-full"
          />
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 0.6 }}
            className="absolute right-0"
          >
            <ArrowRight className="w-3 h-3 text-white/20 -mr-1.5" />
          </motion.div>
        </div>
      )}

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
        className={`relative z-10 w-full rounded-2xl border ${step.border} bg-gradient-to-br ${step.color} p-4 hover:scale-[1.02] transition-transform cursor-default`}
      >
        {/* Step number */}
        <div className="flex items-center justify-between mb-3">
          <div className={`w-9 h-9 rounded-xl ${step.iconBg} flex items-center justify-center`}>
            <Icon className={`w-4.5 h-[18px] w-[18px] ${step.iconColor}`} />
          </div>
          <span className="text-[9px] font-bold uppercase tracking-widest text-white/20">
            {String(index + 1).padStart(2, "0")}
          </span>
        </div>

        <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${step.iconColor}`}>
          {step.label}
        </p>
        <h3 className="text-sm font-bold text-white mb-1 leading-tight">{step.title}</h3>
        <p className="text-[11px] text-white/40 leading-relaxed">{step.desc}</p>

        {/* Mini preview */}
        {step.preview}
      </motion.div>
    </div>
  );
}

export function ProductJourney() {
  const titleRef = useRef(null);
  const titleInView = useInView(titleRef, { once: true, margin: "-60px" });

  return (
    <section className="py-24 lg:py-32 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(249,115,22,0.04),transparent_70%)] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          ref={titleRef}
          initial={{ opacity: 0, y: 24 }}
          animate={titleInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-4">The journey</p>
          <h2 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
            From idea to income —{" "}
            <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
              in one afternoon
            </span>
          </h2>
          <p className="mt-4 text-lg text-white/40 max-w-xl mx-auto">
            Every step from idea to paying customers happens inside Content Flywheel.
          </p>
        </motion.div>

        {/* Grid of steps */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 lg:gap-2">
          {STEPS.map((step, i) => (
            <StepCard key={step.label} step={step} index={i} total={STEPS.length} />
          ))}
        </div>

        {/* Bottom callout */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-12 text-center"
        >
          <p className="text-sm text-white/30">
            Most creators have their first product live within{" "}
            <span className="text-orange-400 font-semibold">one afternoon</span>.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
