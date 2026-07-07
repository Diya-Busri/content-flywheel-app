"use client";

import { motion, useAnimation, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import {
  Sparkles, Package, BarChart3, Video, Mail, Users,
  TrendingUp, Star, ShoppingBag, Zap, Check,
} from "lucide-react";

/* ─── Typing animation hook ─── */
function useTypewriter(text: string, speed = 28, startDelay = 0) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    setDisplayed("");
    setDone(false);
    const timeout = setTimeout(() => {
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) {
          clearInterval(interval);
          setDone(true);
        }
      }, speed);
      return () => clearInterval(interval);
    }, startDelay);
    return () => clearTimeout(timeout);
  }, [text, speed, startDelay]);
  return { displayed, done };
}

/* ─── Mini sidebar nav ─── */
const NAV_ITEMS = [
  { icon: Package, label: "Products", active: false },
  { icon: Sparkles, label: "AI Create", active: true },
  { icon: Video, label: "Video", active: false },
  { icon: BarChart3, label: "Analytics", active: false },
  { icon: Mail, label: "Email", active: false },
  { icon: ShoppingBag, label: "Store", active: false },
];

/* ─── Product cards ─── */
const PRODUCT_CARDS = [
  { title: "7-Day Morning Routine Guide", price: "£19", sales: 42, emoji: "🌅", color: "from-blue-500/20 to-blue-600/10", border: "border-blue-500/20" },
  { title: "Social Media Caption Pack", price: "£27", sales: 87, emoji: "✍️", color: "from-orange-500/20 to-orange-600/10", border: "border-orange-500/20" },
  { title: "Notion Finance Tracker", price: "£15", sales: 31, emoji: "💰", color: "from-emerald-500/20 to-emerald-600/10", border: "border-emerald-500/20" },
];

/* ─── Stat cards ─── */
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

/* ─── Revenue mini chart bars ─── */
const BARS = [40, 55, 45, 70, 60, 85, 75, 92, 80, 100, 88, 110];

/* ─── Main component ─── */
export function HeroDashboard() {
  const [phase, setPhase] = useState<"idle" | "typing" | "generated" | "products">("idle");
  const AI_PROMPT = "Create a 7-day morning routine guide for busy entrepreneurs";
  const { displayed, done } = useTypewriter(AI_PROMPT, 30, 600);

  useEffect(() => {
    setPhase("typing");
    const t1 = setTimeout(() => setPhase("generated"), AI_PROMPT.length * 30 + 1200);
    const t2 = setTimeout(() => setPhase("products"), AI_PROMPT.length * 30 + 2000);
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
              <span className="text-[11px] text-white/30">app.contentflywheel.co.uk/dashboard</span>
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
              <StatCard label="Revenue" value="£2,847" icon={TrendingUp} delay={1200} />
              <StatCard label="Products" value="12 live" icon={Package} delay={1400} />
              <StatCard label="Subscribers" value="384" icon={Users} delay={1600} />
              <div className="ml-auto hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <span className="text-[10px] font-semibold text-orange-400">AI Create</span>
                <Sparkles className="w-3 h-3 text-orange-400" />
              </div>
            </div>

            {/* Split view: left = AI generator, right = products/analytics */}
            <div className="flex flex-1 overflow-hidden">

              {/* AI Generator panel */}
              <div className="flex-1 border-r border-white/[0.05] flex flex-col overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.05]">
                  <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-xs font-semibold text-white/70">AI Product Generator</span>
                </div>

                {/* Prompt input */}
                <div className="px-4 pt-4 pb-3">
                  <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-3">
                    <p className="text-[11px] text-white/30 mb-1.5 font-medium">Your idea</p>
                    <p className="text-xs text-white/80 min-h-[36px] font-mono leading-relaxed">
                      {displayed}
                      {phase === "typing" && <span className="animate-pulse text-orange-400">|</span>}
                    </p>
                    <AnimatePresence>
                      {done && phase === "typing" && (
                        <motion.button
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 text-white text-[11px] font-bold"
                        >
                          <Sparkles className="w-3 h-3" /> Generate
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Generated content preview */}
                <AnimatePresence>
                  {(phase === "generated" || phase === "products") && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5 }}
                      className="px-4 flex-1 overflow-hidden"
                    >
                      <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3 mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Check className="w-3.5 h-3.5 text-green-400" />
                          <span className="text-[10px] font-bold text-green-400 uppercase tracking-wide">Generated in 8 seconds</span>
                        </div>
                        <p className="text-[11px] font-bold text-white mb-1">7-Day Morning Routine Guide</p>
                        <p className="text-[10px] text-white/40">47 pages · PDF + Cover · Ready to sell</p>
                      </div>

                      {/* Preview sections */}
                      <div className="space-y-1.5">
                        {["Introduction & Why Mornings Matter", "Day 1: The 5AM Framework", "Day 2: Movement & Mindset", "Day 3: Deep Work Blocks", "Day 4–7: Full Routine Plans"].map((section, i) => (
                          <motion.div
                            key={section}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 + 0.2 }}
                            className="flex items-center gap-2 text-[10px] text-white/40"
                          >
                            <div className="w-1 h-1 rounded-full bg-orange-500/50 shrink-0" />
                            {section}
                          </motion.div>
                        ))}
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.8 }}
                          className="text-[10px] text-white/25 pl-3"
                        >
                          + 12 more sections...
                        </motion.div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Right panel: products + mini analytics */}
              <div className="w-52 flex-col hidden sm:flex overflow-hidden">
                {/* Products list */}
                <div className="flex items-center justify-between px-3 py-3 border-b border-white/[0.05]">
                  <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wide">Your Products</span>
                  <span className="text-[10px] text-orange-400 font-bold">{phase === "products" ? "13" : "12"} live</span>
                </div>
                <div className="flex-1 overflow-hidden px-2 pt-2 space-y-1.5">
                  {PRODUCT_CARDS.map((p, i) => (
                    <motion.div
                      key={p.title}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: phase !== "idle" ? 1 : 0, x: phase !== "idle" ? 0 : 12 }}
                      transition={{ delay: 1.0 + i * 0.15, duration: 0.4 }}
                      className={`rounded-lg bg-gradient-to-r ${p.color} border ${p.border} p-2.5`}
                    >
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <span className="text-[10px] text-white/70 font-medium leading-tight flex-1">{p.title}</span>
                        <span className="text-[10px] font-bold text-white shrink-0">{p.price}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="w-2.5 h-2.5 text-amber-400" />
                        <span className="text-[9px] text-white/30">{p.sales} sales</span>
                      </div>
                    </motion.div>
                  ))}

                  {/* New product badge */}
                  <AnimatePresence>
                    {phase === "products" && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: 6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 0.4, type: "spring" }}
                        className="rounded-lg border border-orange-500/40 bg-orange-500/10 p-2.5"
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[9px] font-bold text-orange-400 uppercase tracking-wide">✨ New</span>
                        </div>
                        <p className="text-[10px] text-white/70 font-medium">7-Day Morning Routine</p>
                        <p className="text-[9px] text-white/30">Just published · £19</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Mini revenue chart */}
                <div className="border-t border-white/[0.05] px-3 py-2.5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] text-white/25 font-semibold uppercase tracking-wide">Revenue</span>
                    <span className="text-[9px] font-bold text-green-400">+23%</span>
                  </div>
                  <div className="flex items-end gap-0.5 h-10">
                    {BARS.map((h, i) => (
                      <motion.div
                        key={i}
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ delay: 1.2 + i * 0.05, duration: 0.3, ease: "easeOut" }}
                        style={{ originY: 1, height: `${h * 0.4}px` }}
                        className="flex-1 rounded-sm bg-orange-500/40"
                      />
                    ))}
                  </div>
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
        AI writing your product...
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 20, y: 10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 2.4, duration: 0.5 }}
        className="absolute -right-4 top-1/4 hidden lg:flex items-center gap-2 px-3 py-2 rounded-xl bg-[#111] border border-white/10 shadow-xl text-xs text-white/70 font-medium"
      >
        <TrendingUp className="w-3.5 h-3.5 text-green-400" />
        £2,847 this month
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.8, duration: 0.5 }}
        className="absolute -right-2 bottom-16 hidden lg:flex items-center gap-2 px-3 py-2 rounded-xl bg-[#111] border border-orange-500/20 shadow-xl text-xs font-medium text-orange-400"
      >
        <Sparkles className="w-3.5 h-3.5" />
        Product ready in 8s
      </motion.div>
    </div>
  );
}
