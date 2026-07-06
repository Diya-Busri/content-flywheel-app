"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import {
  Sparkles, PenLine, Store, ShoppingBag, BarChart3,
  Megaphone, Mail, Package, Check, Star, TrendingUp,
  Users, Zap, Play, Image as ImageIcon, ArrowRight,
  Eye, Heart, ShoppingCart,
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

function SlideIn({ children, direction = "right", delay = 0, className = "" }: { children: React.ReactNode; direction?: "left" | "right"; delay?: number; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, x: direction === "right" ? 40 : -40 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }} className={className}>
      {children}
    </motion.div>
  );
}

/* ─── Mockup wrapper ─── */
function MockupFrame({ children, glow = "orange", className = "" }: { children: React.ReactNode; glow?: string; className?: string }) {
  const glowColors: Record<string, string> = {
    orange: "rgba(249,115,22,0.15)",
    blue: "rgba(59,130,246,0.15)",
    purple: "rgba(168,85,247,0.15)",
    green: "rgba(34,197,94,0.15)",
    pink: "rgba(236,72,153,0.15)",
    cyan: "rgba(6,182,212,0.15)",
  };
  return (
    <div className={`relative ${className}`}>
      <div
        className="absolute inset-0 blur-2xl rounded-3xl scale-95"
        style={{ background: glowColors[glow] ?? glowColors.orange }}
      />
      <div className="relative rounded-2xl border border-white/10 bg-[#111213] overflow-hidden shadow-2xl shadow-black/50">
        {/* Browser bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] bg-[#0d0e0f]">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="px-3 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.06] text-[10px] text-white/20">
              app.contentflywheel.co.uk
            </div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ─── 1. AI Product Generator mockup ─── */
function AIProductMockup() {
  const [typed] = useState("Write a complete guide on managing anxiety for busy professionals");
  return (
    <MockupFrame glow="orange">
      <div className="p-5 space-y-4">
        {/* Prompt */}
        <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-4">
          <p className="text-[10px] text-white/30 mb-2 font-semibold uppercase tracking-wide">Your idea</p>
          <p className="text-xs text-white/80 font-mono leading-relaxed">{typed}</p>
          <div className="flex items-center gap-2 mt-3">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 text-[11px] font-bold text-white">
              <Sparkles className="w-3 h-3" /> Generate with AI
            </button>
            <span className="text-[10px] text-white/20">~8 seconds</span>
          </div>
        </div>
        {/* Result */}
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Check className="w-3.5 h-3.5 text-green-400" />
            <span className="text-[10px] font-bold text-green-400">Product generated successfully</span>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-12 h-16 rounded-lg bg-gradient-to-br from-orange-500/30 to-amber-600/20 border border-orange-500/20 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Managing Anxiety for Busy Professionals</p>
              <p className="text-[11px] text-white/40 mt-0.5">52-page guide · PDF + Cover design</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/30">47 sections</span>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/30">12 exercises</span>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/30">Checklist</span>
              </div>
            </div>
          </div>
        </div>
        {/* Chapter list */}
        <div className="space-y-1.5">
          <p className="text-[10px] text-white/30 font-semibold">Chapters</p>
          {["Understanding Your Anxiety Triggers", "The 5-Minute Calm Protocol", "Workday Boundaries & Deep Work", "Sleep, Recovery & Nervous System Reset"].map((c, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px] text-white/50">
              <div className="w-4 h-4 rounded-md bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0 text-[9px] text-orange-400 font-bold">{i + 1}</div>
              {c}
            </div>
          ))}
          <p className="text-[10px] text-white/20 pl-6">+ 8 more chapters...</p>
        </div>
      </div>
    </MockupFrame>
  );
}

/* ─── 2. Design Studio mockup ─── */
function DesignStudioMockup() {
  return (
    <MockupFrame glow="purple">
      <div className="flex h-64">
        {/* Left toolbar */}
        <div className="w-10 border-r border-white/[0.06] bg-[#0d0e0f] flex flex-col items-center py-3 gap-2">
          {[ImageIcon, PenLine, Zap, Star].map((Icon, i) => (
            <div key={i} className={`w-7 h-7 rounded-lg flex items-center justify-center ${i === 0 ? "bg-purple-500/20 text-purple-400" : "text-white/20"}`}>
              <Icon className="w-3.5 h-3.5" />
            </div>
          ))}
        </div>
        {/* Canvas */}
        <div className="flex-1 bg-[#161718] flex items-center justify-center p-4 relative overflow-hidden">
          {/* Grid pattern */}
          <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
          {/* Product cover */}
          <div className="relative">
            <div className="w-32 h-44 rounded-xl bg-gradient-to-br from-purple-600/40 via-purple-800/30 to-black border border-purple-500/30 shadow-2xl flex flex-col items-center justify-center gap-2 p-4">
              <div className="text-2xl">🧘</div>
              <div className="text-center">
                <p className="text-[8px] font-bold text-white leading-tight">Managing Anxiety for Busy Professionals</p>
                <p className="text-[7px] text-white/40 mt-1">A Complete Guide</p>
              </div>
            </div>
            {/* Selection handles */}
            <div className="absolute -inset-1 border-2 border-blue-500 rounded-xl opacity-60" />
            <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-sm" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-sm" />
            <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-sm" />
            <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-sm" />
          </div>
        </div>
        {/* Right panel */}
        <div className="w-36 border-l border-white/[0.06] bg-[#0d0e0f] p-3 space-y-3">
          <div>
            <p className="text-[9px] text-white/25 uppercase tracking-wide font-semibold mb-2">Colours</p>
            <div className="flex gap-1.5 flex-wrap">
              {["#7C3AED", "#8B5CF6", "#1a1a2e", "#ffffff", "#F59E0B"].map((c, i) => (
                <div key={i} className={`w-5 h-5 rounded-md ring-1 ${i === 0 ? "ring-white/60 scale-110" : "ring-white/10"}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div>
            <p className="text-[9px] text-white/25 uppercase tracking-wide font-semibold mb-2">Font</p>
            <div className="rounded-lg bg-white/[0.04] border border-white/[0.08] px-2 py-1.5 text-[10px] text-white/50">Inter Bold</div>
          </div>
          <div>
            <p className="text-[9px] text-white/25 uppercase tracking-wide font-semibold mb-2">Layers</p>
            {["Cover Background", "Title Text", "Author Name", "Decorative"].map((l, i) => (
              <div key={i} className={`flex items-center gap-1.5 py-0.5 text-[9px] ${i === 0 ? "text-blue-400" : "text-white/25"}`}>
                <div className="w-1 h-1 rounded-full bg-current" />
                {l}
              </div>
            ))}
          </div>
        </div>
      </div>
    </MockupFrame>
  );
}

/* ─── 3. Store Builder mockup ─── */
function StoreMockup() {
  return (
    <MockupFrame glow="blue">
      <div className="p-4 space-y-3">
        {/* Store header */}
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="h-16 bg-gradient-to-r from-blue-900/40 to-purple-900/30 flex items-center px-4 gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white font-bold text-sm">J</div>
            <div>
              <p className="text-xs font-bold text-white">Jessica&apos;s Digital Shop</p>
              <p className="text-[10px] text-white/40">jessica.contentflywheel.co.uk</p>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-[9px] text-green-400 font-semibold">Live</span>
            </div>
          </div>
          {/* Products grid */}
          <div className="grid grid-cols-3 gap-2 p-3 bg-[#161718]">
            {[
              { title: "Morning Routine Guide", price: "£19", emoji: "🌅" },
              { title: "Caption Pack", price: "£27", emoji: "✍️" },
              { title: "Finance Tracker", price: "£15", emoji: "💰" },
            ].map((p, i) => (
              <div key={i} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 group cursor-pointer hover:border-orange-500/30 transition-colors">
                <div className="text-xl mb-1.5">{p.emoji}</div>
                <p className="text-[9px] font-semibold text-white/70 leading-tight mb-1">{p.title}</p>
                <p className="text-[10px] font-bold text-orange-400">{p.price}</p>
                <div className="flex items-center gap-0.5 mt-1">
                  {[...Array(5)].map((_, j) => <Star key={j} className="w-2 h-2 text-amber-400 fill-amber-400" />)}
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Visitor stats */}
        <div className="grid grid-cols-3 gap-2">
          {[{ l: "Today's Views", v: "127" }, { l: "Conversions", v: "8.4%" }, { l: "Revenue", v: "£216" }].map((s) => (
            <div key={s.l} className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2 text-center">
              <p className="text-sm font-bold text-white">{s.v}</p>
              <p className="text-[9px] text-white/30 leading-tight">{s.l}</p>
            </div>
          ))}
        </div>
      </div>
    </MockupFrame>
  );
}

/* ─── 4. Marketplace mockup ─── */
function MarketplaceMockup() {
  return (
    <MockupFrame glow="green">
      <div className="p-4">
        {/* Search bar */}
        <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 mb-4">
          <ShoppingBag className="w-3.5 h-3.5 text-white/30" />
          <span className="text-[11px] text-white/25">Search 2,000+ digital products...</span>
          <button className="ml-auto px-2.5 py-1 rounded-lg bg-orange-500 text-[10px] font-bold text-white">Search</button>
        </div>
        {/* Category pills */}
        <div className="flex gap-1.5 mb-4 flex-wrap">
          {["All", "Ebooks", "Templates", "Planners", "Courses", "Bundles"].map((c, i) => (
            <span key={c} className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${i === 0 ? "bg-orange-500 text-white" : "bg-white/[0.04] text-white/40 border border-white/[0.08]"}`}>{c}</span>
          ))}
        </div>
        {/* Products grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { title: "100-Day Habit Tracker", creator: "Sam K.", price: "£22", sales: "1.2k", emoji: "📋", hot: true },
            { title: "Social Media Vault", creator: "Emma R.", price: "£35", sales: "847", emoji: "📱", hot: false },
            { title: "Freelance Contract Kit", creator: "Jake T.", price: "£18", sales: "2.1k", emoji: "📄", hot: true },
            { title: "YouTube Script Pack", creator: "Mia S.", price: "£29", sales: "634", emoji: "🎬", hot: false },
          ].map((p, i) => (
            <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 hover:border-green-500/30 transition-colors cursor-pointer group">
              <div className="flex items-start justify-between mb-2">
                <div className="text-xl">{p.emoji}</div>
                {p.hot && <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-bold border border-orange-500/30">🔥 Hot</span>}
              </div>
              <p className="text-[10px] font-semibold text-white/70 leading-tight mb-1.5">{p.title}</p>
              <p className="text-[9px] text-white/30 mb-2">by {p.creator}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">{p.price}</span>
                <span className="text-[9px] text-white/25">{p.sales} sold</span>
              </div>
              <div className="flex items-center gap-1 mt-1.5">
                <Heart className="w-3 h-3 text-white/20 group-hover:text-pink-400 transition-colors" />
                <ShoppingCart className="w-3 h-3 text-white/20 group-hover:text-green-400 transition-colors ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </MockupFrame>
  );
}

/* ─── 5. Analytics Dashboard mockup ─── */
function AnalyticsMockup() {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const VALUES = [1200, 1800, 2400, 1900, 3200, 2847];
  const MAX = Math.max(...VALUES);

  return (
    <MockupFrame glow="cyan">
      <div className="p-4 space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { l: "Total Revenue", v: "£12,847", change: "+23%", up: true },
            { l: "Products Sold", v: "486", change: "+18%", up: true },
            { l: "Avg. Order", v: "£26.40", change: "+5%", up: true },
            { l: "Refund Rate", v: "0.8%", change: "-2%", up: false },
          ].map((s) => (
            <div key={s.l} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
              <p className="text-[9px] text-white/30 mb-1">{s.l}</p>
              <p className="text-base font-bold text-white">{s.v}</p>
              <p className={`text-[9px] font-semibold ${s.up ? "text-green-400" : "text-red-400"}`}>{s.change}</p>
            </div>
          ))}
        </div>
        {/* Revenue chart */}
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold text-white/70">Monthly Revenue</p>
            <span className="text-[10px] text-white/30">Last 6 months</span>
          </div>
          <div className="flex items-end gap-2 h-24">
            {VALUES.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <motion.div
                  initial={{ scaleY: 0 }}
                  whileInView={{ scaleY: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.4 }}
                  style={{ originY: 1, height: `${(v / MAX) * 80}px` }}
                  className={`w-full rounded-md ${i === VALUES.length - 1 ? "bg-orange-500/70" : "bg-white/10"}`}
                />
                <span className="text-[8px] text-white/25">{MONTHS[i]}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Top products */}
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
          <p className="text-[10px] font-semibold text-white/40 mb-2">Top Products</p>
          <div className="space-y-2">
            {[
              { name: "Morning Routine Guide", revenue: "£2,847", pct: 85 },
              { name: "Caption Pack", revenue: "£1,943", pct: 60 },
              { name: "Finance Tracker", revenue: "£987", pct: 32 },
            ].map((p) => (
              <div key={p.name} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-white/60">{p.name}</span>
                    <span className="text-[10px] font-bold text-white">{p.revenue}</span>
                  </div>
                  <div className="h-1 rounded-full bg-white/[0.05]">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${p.pct}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MockupFrame>
  );
}

/* ─── 6. AI Marketing Tools mockup ─── */
function MarketingMockup() {
  return (
    <MockupFrame glow="pink">
      <div className="p-4 space-y-3">
        {/* Tab bar */}
        <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1">
          {["Video Scripts", "Captions", "Hooks", "Hashtags"].map((t, i) => (
            <button key={t} className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-colors ${i === 0 ? "bg-orange-500 text-white" : "text-white/30 hover:text-white/60"}`}>{t}</button>
          ))}
        </div>
        {/* Content */}
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-pink-500/15 flex items-center justify-center">
              <Play className="w-3.5 h-3.5 text-pink-400" />
            </div>
            <p className="text-xs font-bold text-white/70">TikTok Hook Script</p>
            <span className="ml-auto text-[9px] px-2 py-0.5 rounded-full bg-pink-500/15 text-pink-400 border border-pink-500/20">30s</span>
          </div>
          <div className="space-y-2 text-[11px] text-white/60 leading-relaxed font-mono">
            <p className="text-orange-400">[Hook] &quot;If you&apos;re always exhausted by 9am...&quot;</p>
            <p>[Show product] Morning Routine Guide on screen</p>
            <p>[CTA] &quot;Link in bio — £19 for the full 7-day system&quot;</p>
          </div>
        </div>
        {/* Generated posts */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { platform: "📸 Instagram", text: "Transform your mornings in 7 days ✨ My step-by-step guide shows you exactly how...", color: "from-pink-500/10 to-purple-500/10 border-pink-500/20" },
            { platform: "🎵 TikTok", text: "POV: You finally have a morning routine that actually works 🌅 Link in bio...", color: "from-cyan-500/10 to-blue-500/10 border-cyan-500/20" },
          ].map((p) => (
            <div key={p.platform} className={`rounded-xl border bg-gradient-to-br ${p.color} p-3`}>
              <p className="text-[9px] font-bold text-white/50 mb-2">{p.platform}</p>
              <p className="text-[10px] text-white/60 leading-relaxed line-clamp-3">{p.text}</p>
              <div className="flex items-center gap-1.5 mt-2">
                <Eye className="w-3 h-3 text-white/20" />
                <span className="text-[9px] text-white/20">2.4k est reach</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </MockupFrame>
  );
}

/* ─── 7. Email Marketing mockup ─── */
function EmailMockup() {
  return (
    <MockupFrame glow="blue">
      <div className="flex h-64">
        {/* Sidebar */}
        <div className="w-32 border-r border-white/[0.06] bg-[#0d0e0f] p-3">
          <p className="text-[9px] text-white/25 uppercase tracking-wide font-semibold mb-2">Campaigns</p>
          {[
            { name: "Welcome Series", status: "active", color: "bg-green-400" },
            { name: "Launch Sequence", status: "active", color: "bg-green-400" },
            { name: "Weekly Digest", status: "draft", color: "bg-amber-400" },
            { name: "Re-engage", status: "paused", color: "bg-white/20" },
          ].map((c) => (
            <div key={c.name} className="flex items-center gap-2 py-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${c.color}`} />
              <span className="text-[9px] text-white/40">{c.name}</span>
            </div>
          ))}
          <div className="mt-3 pt-3 border-t border-white/[0.06]">
            <p className="text-[9px] text-white/25 uppercase tracking-wide font-semibold mb-2">List</p>
            <p className="text-sm font-bold text-white">2,847</p>
            <p className="text-[9px] text-white/30">subscribers</p>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3 text-green-400" />
              <span className="text-[9px] text-green-400 font-semibold">+48 this week</span>
            </div>
          </div>
        </div>
        {/* Email preview */}
        <div className="flex-1 p-4 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-white/70">Welcome Series — Email 1</p>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20 font-semibold">Active</span>
          </div>
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <div className="border-b border-white/[0.06] pb-2 mb-3 space-y-1">
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-white/25">From:</span>
                <span className="text-white/60">Jessica (jessica@contentflywheel.co.uk)</span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-white/25">Subject:</span>
                <span className="text-white/80 font-semibold">Your morning routine guide is here 🌅</span>
              </div>
            </div>
            <div className="space-y-2 text-[10px] text-white/50 leading-relaxed">
              <p>Hey [First Name]! 👋</p>
              <p>Thank you so much for grabbing the 7-Day Morning Routine Guide. I put everything I know into this...</p>
              <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 p-2 text-center">
                <p className="text-[10px] font-bold text-orange-400">→ Download Your Guide</p>
              </div>
            </div>
          </div>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            {[{ l: "Open Rate", v: "47.3%" }, { l: "Click Rate", v: "12.8%" }, { l: "Unsubscribes", v: "0.2%" }].map((s) => (
              <div key={s.l} className="text-center">
                <p className="text-sm font-bold text-white">{s.v}</p>
                <p className="text-[9px] text-white/25">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MockupFrame>
  );
}

/* ─── 8. Product Library mockup ─── */
function LibraryMockup() {
  return (
    <MockupFrame glow="orange">
      <div className="p-4">
        {/* Toolbar */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2">
            <Package className="w-3.5 h-3.5 text-white/30" />
            <span className="text-[10px] text-white/25">Search products...</span>
          </div>
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-orange-500 text-[10px] font-bold text-white">
            <Sparkles className="w-3 h-3" /> New
          </button>
        </div>
        {/* Grid */}
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { title: "Morning Routine", status: "Published", sales: 42, price: "£19", emoji: "🌅" },
            { title: "Caption Pack", status: "Published", sales: 87, price: "£27", emoji: "✍️" },
            { title: "Finance Tracker", status: "Published", sales: 31, price: "£15", emoji: "💰" },
            { title: "Anxiety Guide", status: "Published", sales: 12, price: "£22", emoji: "🧘" },
            { title: "YouTube Kit", status: "Draft", sales: 0, price: "£39", emoji: "🎬" },
            { title: "Notion Bundle", status: "Draft", sales: 0, price: "£49", emoji: "📋" },
          ].map((p) => (
            <div key={p.title} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 hover:border-orange-500/30 transition-colors group cursor-pointer">
              <div className="text-xl mb-2">{p.emoji}</div>
              <p className="text-[10px] font-semibold text-white/70 leading-tight mb-1.5">{p.title}</p>
              <div className="flex items-center justify-between">
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${p.status === "Published" ? "bg-green-500/15 text-green-400 border border-green-500/20" : "bg-white/5 text-white/25 border border-white/10"}`}>{p.status}</span>
                <span className="text-[9px] font-bold text-white">{p.price}</span>
              </div>
              {p.sales > 0 && (
                <div className="flex items-center gap-1 mt-1.5">
                  <Users className="w-2.5 h-2.5 text-white/20" />
                  <span className="text-[8px] text-white/25">{p.sales} sales</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </MockupFrame>
  );
}

/* ─── Feature row component ─── */
interface Feature {
  tag: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle: string;
  bullets: string[];
  cta: string;
  mockup: React.ReactNode;
  reverse?: boolean;
}

const FEATURES: Feature[] = [
  {
    tag: "AI Product Generator",
    icon: Sparkles,
    iconColor: "text-orange-400",
    iconBg: "bg-orange-500/15",
    title: "Describe it. AI builds it. Done.",
    subtitle: "Type your idea and get a complete, formatted digital product in under 10 seconds — ebooks, planners, guides, workbooks, templates.",
    bullets: [
      "Full PDF with cover design included",
      "Structured chapters and exercises",
      "Edit any section with one click",
      "50+ product types supported",
    ],
    cta: "Try it free",
    mockup: <AIProductMockup />,
    reverse: false,
  },
  {
    tag: "Design Studio",
    icon: PenLine,
    iconColor: "text-purple-400",
    iconBg: "bg-purple-500/15",
    title: "Make it look premium. Instantly.",
    subtitle: "A full canvas editor for covers, social graphics, and slide decks. No design skills needed — just pick a template and personalise.",
    bullets: [
      "100+ premium templates",
      "Custom colour palettes and fonts",
      "AI-generated mockup images",
      "Export PDF-ready files",
    ],
    cta: "Try it free",
    mockup: <DesignStudioMockup />,
    reverse: true,
  },
  {
    tag: "Store Builder",
    icon: Store,
    iconColor: "text-blue-400",
    iconBg: "bg-blue-500/15",
    title: "Your own branded store. Zero setup.",
    subtitle: "Get a beautiful storefront at yourname.contentflywheel.co.uk. Stripe-powered payments, automatic delivery, no listing fees.",
    bullets: [
      "Custom domain support",
      "Stripe payments — you keep earnings",
      "Automatic PDF delivery on purchase",
      "Discount codes and promo links",
    ],
    cta: "Try it free",
    mockup: <StoreMockup />,
    reverse: false,
  },
  {
    tag: "AI Marketing Tools",
    icon: Megaphone,
    iconColor: "text-pink-400",
    iconBg: "bg-pink-500/15",
    title: "Content that sells — written for you.",
    subtitle: "Turn any product into TikTok scripts, Instagram captions, YouTube hooks, email sequences, and hashtag sets. In seconds.",
    bullets: [
      "Platform-specific copy for every channel",
      "Viral hook formulas built in",
      "Bulk generate 30 days of content",
      "Carousel slides for social media",
    ],
    cta: "Try it free",
    mockup: <MarketingMockup />,
    reverse: true,
  },
];

/* ─── Single feature row ─── */
function FeatureRow({ feature, index }: { feature: Feature; index: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const Icon = feature.icon;

  return (
    <div
      ref={ref}
      className={`grid lg:grid-cols-2 gap-12 lg:gap-20 items-center ${feature.reverse ? "lg:grid-flow-dense" : ""}`}
    >
      {/* Text side */}
      <motion.div
        initial={{ opacity: 0, x: feature.reverse ? 32 : -32 }}
        animate={inView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className={feature.reverse ? "lg:col-start-2" : ""}
      >
        {/* Tag */}
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${feature.iconBg} border-white/10 mb-5`}>
          <Icon className={`w-3.5 h-3.5 ${feature.iconColor}`} />
          <span className={`text-xs font-bold ${feature.iconColor}`}>{feature.tag}</span>
        </div>

        <h3 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight mb-4">
          {feature.title}
        </h3>
        <p className="text-base text-white/50 leading-relaxed mb-6">
          {feature.subtitle}
        </p>

        <ul className="space-y-2.5 mb-8">
          {feature.bullets.map((b) => (
            <li key={b} className="flex items-start gap-3">
              <div className={`mt-0.5 w-5 h-5 rounded-full ${feature.iconBg} flex items-center justify-center shrink-0`}>
                <Check className={`w-3 h-3 ${feature.iconColor}`} />
              </div>
              <span className="text-sm text-white/60">{b}</span>
            </li>
          ))}
        </ul>

        <Link
          href="/signup"
          className={`inline-flex items-center gap-2 text-sm font-semibold ${feature.iconColor} group hover:opacity-80 transition-opacity`}
        >
          {feature.cta}
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      </motion.div>

      {/* Mockup side */}
      <motion.div
        initial={{ opacity: 0, x: feature.reverse ? -32 : 32 }}
        animate={inView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className={feature.reverse ? "lg:col-start-1 lg:row-start-1" : ""}
      >
        {feature.mockup}
      </motion.div>
    </div>
  );
}

/* ─── Section header ─── */
export function FeatureShowcase() {
  return (
    <section id="features" className="py-24 lg:py-32 relative overflow-hidden">
      {/* Subtle background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(249,115,22,0.03),transparent_60%)] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6">
        <FadeUp className="text-center mb-20">
          <p className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-4">Everything you need</p>
          <h2 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
            Four core tools.{" "}
            <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
              One subscription.
            </span>
          </h2>
          <p className="mt-4 text-lg text-white/40 max-w-xl mx-auto">
            Replace your entire creator tech stack with tools that actually talk to each other.
          </p>
        </FadeUp>

        <div className="space-y-28 lg:space-y-36">
          {FEATURES.map((feature, index) => (
            <FeatureRow key={feature.tag} feature={feature} index={index} />
          ))}
        </div>

        {/* Also included — compact grid */}
        <FadeUp className="mt-24 pt-16 border-t border-white/[0.06]">
          <p className="text-center text-xs font-bold uppercase tracking-widest text-white/30 mb-8">Also included</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: ShoppingBag, color: "text-green-400", bg: "bg-green-500/10", title: "Marketplace", desc: "List products and reach buyers beyond your own audience." },
              { icon: BarChart3, color: "text-cyan-400", bg: "bg-cyan-500/10", title: "Analytics Dashboard", desc: "Revenue, conversions, and top products in real time." },
              { icon: Mail, color: "text-blue-400", bg: "bg-blue-500/10", title: "Email Marketing", desc: "Collect subscribers and send campaigns — no Mailchimp needed." },
              { icon: Package, color: "text-orange-400", bg: "bg-orange-500/10", title: "Product Library", desc: "All your products, drafts, and sales data in one place." },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex items-start gap-3 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                  <div className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-4 h-4 ${item.color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white/70 mb-0.5">{item.title}</p>
                    <p className="text-xs text-white/35 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
