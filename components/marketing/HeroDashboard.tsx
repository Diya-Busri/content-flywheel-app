"use client";

import { motion, useAnimation, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import {
  Sparkles, Package, BarChart3, Video, Mail, Search,
  TrendingUp, Layers, Megaphone, Zap, Check, Rocket,
} from "lucide-react";

/* ─── Nav ─── */
const NAV_ITEMS = [
  { icon: Package, label: "Product", active: false },
  { icon: Sparkles, label: "Marketing Engine", active: true },
  { icon: Video, label: "Video", active: false },
  { icon: BarChart3, label: "Analytics", active: false },
  { icon: Mail, label: "Email", active: false },
  { icon: Rocket, label: "Launch", active: false },
];

/* ─── Outputs generated from the one product ─── */
const OUTPUTS = [
  { label: "Audience research", icon: Search, color: "from-cyan-500/20 to-cyan-600/10", border: "border-cyan-500/20", iconColor: "text-cyan-400" },
  { label: "12 viral hooks", icon: Sparkles, color: "from-orange-500/20 to-orange-600/10", border: "border-orange-500/20", iconColor: "text-orange-400" },
  { label: "6 carousel decks", icon: Layers, color: "from-purple-500/20 to-purple-600/10", border: "border-purple-500/20", iconColor: "text-purple-400" },
  { label: "TikTok scripts", icon: Video, color: "from-pink-500/20 to-pink-600/10", border: "border-pink-500/20", iconColor: "text-pink-400" },
  { label: "Email sequence", icon: Mail, color: "from-blue-500/20 to-blue-600/10", border: "border-blue-500/20", iconColor: "text-blue-400" },
  { label: "Launch plan", icon: Megaphone, color: "from-emerald-500/20 to-emerald-600/10", border: "border-emerald-500/20", iconColor: "text-emerald-400" },
];

function StatCard({ label, value, icon: Icon, delay }: { label: string; value: string; icon: React.ElementType; delay: number }) {
  const controls = useAnimation();
  useEffect(() => {
    const t = setTimeout(() => controls.start({ opacity: 1, y: 0 }), delay);
    return () => clearTimeout(t);
  }, [controls, delay]);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={controls}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex items-center gap-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5"
    >
      <div className="w-7 h-7 rounded-lg bg-orange-500/15 flex items-center justify-center shrink-0">
        <Icon className="w-3.5 h-3.5 text-orange-400" />
      </div>
      <div>
        <p className="text-[10px] text-white/35 leading-none mb-0.5">{label}</p>
        <p className="text-sm font-bold text-white leading-none">{value}</p>
      </div>
    </motion.div>
  );
}

/* ─── Main component ─── */
export function HeroDashboard() {
  const [phase, setPhase] = useState<"idle" | "analyzing" | "generated" | "content">("idle");

  useEffect(() => {
    setPhase("analyzing");
    const t1 = setTimeout(() => setPhase("generated"), 1400);
    const t2 = setTimeout(() => setPhase("content"), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div className="relative mx-auto max-w-5xl px-4 sm:px-6">
      {/* Glow behind the window */}
      <div className="absolute inset-0 -top-8 bg-orange-500/10 blur-3xl rounded-full pointer-events-none" />

      {/* Browser chrome */}
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative rounded-2xl border border-white/10 bg-[#111213] shadow-2xl shadow-black/60 overflow-hidden"
      >
        {/* Title bar */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.07] bg-[#0d0e0f]">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-amber-500/60" />
            <div className="w-3 h-3 rounded-full bg-green-500/60" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-2 px-4 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-[11px] text-white/30">app.contentflywheel.co.uk/marketing-engine</span>
            </div>
          </div>
        </div>

        {/* App layout */}
        <div className="flex h-[440px] sm:h-[500px]">

          {/* Sidebar */}
          <div className="w-14 shrink-0 border-r border-white/[0.06] bg-[#0d0e0f] flex flex-col items-center py-4 gap-1">
            {/* Logo mark */}
            <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center mb-4">
              <Zap className="w-4 h-4 text-white" />
            </div>
            {NAV_ITEMS.map(({ icon: Icon, label, active }) => (
              <div
                key={label}
                title={label}
                className={`w-9 h-9 rounded-xl flex items-center justify-center cursor-default transition-colors ${
                  active ? "bg-orange-500/20 text-orange-400" : "text-white/20 hover:text-white/40"
                }`}
              >
                <Icon className="w-4.5 h-4.5 w-[18px] h-[18px]" />
              </div>
            ))}
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top stat bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.05]">
              <StatCard label="Content pieces" value="38 ready" icon={Layers} delay={1200} />
              <StatCard label="Est. reach" value="24.6k" icon={TrendingUp} delay={1400} />
              <StatCard label="Time saved" value="~14 hrs" icon={Sparkles} delay={1600} />
              <div className="ml-auto hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <span className="text-[10px] font-semibold text-orange-400">Marketing Engine</span>
                <Sparkles className="w-3 h-3 text-orange-400" />
              </div>
            </div>

            {/* One product in, everything out */}
            <div className="flex flex-1 overflow-hidden">

              {/* Left: the one input product */}
              <div className="w-52 shrink-0 border-r border-white/[0.05] flex flex-col overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.05]">
                  <Package className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-xs font-semibold text-white/70">Your product</span>
                </div>
                <div className="px-4 pt-4">
                  <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-3">
                    <div className="w-10 h-14 rounded-lg bg-gradient-to-br from-orange-500/30 to-amber-600/20 border border-orange-500/20 flex items-center justify-center mb-3">
                      <span className="text-lg">🌅</span>
                    </div>
                    <p className="text-[11px] font-bold text-white leading-tight">7-Day Morning Routine Guide</p>
                    <p className="text-[10px] text-white/40 mt-1">PDF guide · £19</p>
                  </div>
                </div>

                <AnimatePresence>
                  {phase === "analyzing" && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="px-4 pt-4 flex items-center gap-2"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                      <span className="text-[10px] text-orange-400 font-mono">Analyzing product & audience...</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {(phase === "generated" || phase === "content") && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="px-4 pt-4"
                    >
                      <div className="rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2 flex items-center gap-2">
                        <Check className="w-3 h-3 text-green-400 shrink-0" />
                        <span className="text-[10px] text-green-400 font-semibold">Campaign generated</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Right: everything generated from it */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
                  <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wide">Generated for you</span>
                  <span className="text-[10px] text-orange-400 font-bold">{phase === "content" ? "6" : "0"}/6</span>
                </div>
                <div className="flex-1 p-3 grid grid-cols-2 gap-2 content-start overflow-hidden">
                  {OUTPUTS.map((o, i) => {
                    const Icon = o.icon;
                    return (
                      <motion.div
                        key={o.label}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: phase === "content" ? 1 : 0, y: phase === "content" ? 0 : 10 }}
                        transition={{ delay: i * 0.12, duration: 0.4 }}
                        className={`rounded-lg bg-gradient-to-br ${o.color} border ${o.border} p-2.5`}
                      >
                        <Icon className={`w-3.5 h-3.5 ${o.iconColor} mb-1.5`} />
                        <p className="text-[10px] text-white/70 font-medium leading-tight">{o.label}</p>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Floating feature badges */}
      <motion.div
        initial={{ opacity: 0, x: -20, y: 10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 2.0, duration: 0.5 }}
        className="absolute -left-4 top-1/3 hidden lg:flex items-center gap-2 px-3 py-2 rounded-xl bg-[#111] border border-white/10 shadow-xl text-xs text-white/70 font-medium"
      >
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        One product, six weeks of content
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 20, y: 10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 2.4, duration: 0.5 }}
        className="absolute -right-4 top-1/4 hidden lg:flex items-center gap-2 px-3 py-2 rounded-xl bg-[#111] border border-white/10 shadow-xl text-xs text-white/70 font-medium"
      >
        <TrendingUp className="w-3.5 h-3.5 text-green-400" />
        24.6k estimated reach
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.8, duration: 0.5 }}
        className="absolute -right-2 bottom-16 hidden lg:flex items-center gap-2 px-3 py-2 rounded-xl bg-[#111] border border-orange-500/20 shadow-xl text-xs font-medium text-orange-400"
      >
        <Sparkles className="w-3.5 h-3.5" />
        Full campaign in seconds
      </motion.div>
    </div>
  );
}
