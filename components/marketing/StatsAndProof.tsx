"use client";

import { motion, useInView, useMotionValue, useSpring, animate } from "framer-motion";
import { useEffect, useRef } from "react";
import { Star, TrendingUp, Package, Users, Zap } from "lucide-react";

/* ─── Animated counter ─── */
function Counter({ to, prefix = "", suffix = "", duration = 1.8, delay = 0 }: {
  to: number; prefix?: string; suffix?: string; duration?: number; delay?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inViewRef = useRef(null);
  const inView = useInView(inViewRef, { once: true, margin: "-60px" });

  useEffect(() => {
    if (!inView || !ref.current) return;
    const timeout = setTimeout(() => {
      const controls = animate(0, to, {
        duration,
        ease: "easeOut",
        onUpdate(v) {
          if (ref.current) {
            ref.current.textContent = prefix + (to >= 1000 ? Math.round(v).toLocaleString() : Math.round(v * 10) / 10) + suffix;
          }
        },
      });
      return () => controls.stop();
    }, delay * 1000);
    return () => clearTimeout(timeout);
  }, [inView, to, duration, delay, prefix, suffix]);

  return (
    <div ref={inViewRef}>
      <span ref={ref}>{prefix}0{suffix}</span>
    </div>
  );
}

/* ─── Stats section ─── */
const STATS = [
  { icon: Package, label: "Products Created", value: 14800, suffix: "+", color: "text-orange-400", bgColor: "bg-orange-500/15", borderColor: "border-orange-500/20" },
  { icon: Users, label: "Active Creators", value: 1200, suffix: "+", color: "text-blue-400", bgColor: "bg-blue-500/15", borderColor: "border-blue-500/20" },
  { icon: TrendingUp, label: "Revenue Generated", prefix: "£", value: 280000, suffix: "+", color: "text-green-400", bgColor: "bg-green-500/15", borderColor: "border-green-500/20" },
  { icon: Zap, label: "AI Generations", value: 48000, suffix: "+", color: "text-purple-400", bgColor: "bg-purple-500/15", borderColor: "border-purple-500/20" },
];

/* ─── Testimonials ─── */
const TESTIMONIALS = [
  {
    quote: "I had my first digital product live within an hour of signing up. The AI wrote the whole thing — I just tweaked a few bits. Already made back my subscription three times over.",
    name: "Sarah M.",
    role: "Fitness Coach",
    avatar: "SM",
    rating: 5,
    color: "from-orange-500/10 to-orange-600/5",
  },
  {
    quote: "I used to spend £80/month on tools that didn't work together. Now everything's in one place and my email list has grown 3x since I switched.",
    name: "Jake R.",
    role: "Business Consultant",
    avatar: "JR",
    rating: 5,
    color: "from-blue-500/10 to-blue-600/5",
  },
  {
    quote: "The Design Studio alone is worth it. My covers look like they were made by a professional. My conversion rate went from 3% to 8% after updating my product images.",
    name: "Emma L.",
    role: "Digital Creator",
    avatar: "EL",
    rating: 5,
    color: "from-purple-500/10 to-purple-600/5",
  },
  {
    quote: "I launched a Notion template pack in a weekend. The marketing tools created all my TikTok captions and I hit £1k in revenue before the Monday.",
    name: "Marcus T.",
    role: "Productivity Coach",
    avatar: "MT",
    rating: 5,
    color: "from-green-500/10 to-green-600/5",
  },
  {
    quote: "What I love is that it's all connected. I create the product, it goes straight to my store, I generate content to promote it, and track the sales — zero faff.",
    name: "Priya K.",
    role: "Finance Creator",
    avatar: "PK",
    rating: 5,
    color: "from-pink-500/10 to-pink-600/5",
  },
  {
    quote: "The AI coach helps me whenever I'm stuck. Asked it how to price my first ebook and it walked me through the whole strategy. It's like having a business partner.",
    name: "Tom H.",
    role: "Career Coach",
    avatar: "TH",
    rating: 5,
    color: "from-amber-500/10 to-amber-600/5",
  },
];

function TestimonialCard({ t, delay }: { t: typeof TESTIMONIALS[0]; delay: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`rounded-2xl border border-white/[0.07] bg-gradient-to-br ${t.color} p-6 hover:border-white/20 transition-colors`}
    >
      {/* Stars */}
      <div className="flex gap-0.5 mb-4">
        {[...Array(t.rating)].map((_, i) => (
          <Star key={i} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
        ))}
      </div>
      {/* Quote */}
      <p className="text-sm text-white/65 leading-relaxed mb-5">
        &ldquo;{t.quote}&rdquo;
      </p>
      {/* Author */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-[11px] font-bold text-orange-400">
          {t.avatar}
        </div>
        <div>
          <p className="text-sm font-bold text-white">{t.name}</p>
          <p className="text-xs text-white/30">{t.role}</p>
        </div>
      </div>
    </motion.div>
  );
}

export function StatsAndProof() {
  const sectionRef = useRef(null);
  const sectionInView = useInView(sectionRef, { once: true, margin: "-60px" });

  return (
    <>
      {/* ─── Stats ─── */}
      <section className="py-20 border-y border-white/[0.05] bg-white/[0.02] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(249,115,22,0.06),transparent_60%)] pointer-events-none" />
        <div className="max-w-6xl mx-auto px-6">
          <div ref={sectionRef} className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {STATS.map((s, i) => {
              const Icon = s.icon;
              return (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={sectionInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="text-center"
                >
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl ${s.bgColor} border ${s.borderColor} mb-4`}>
                    <Icon className={`w-5 h-5 ${s.color}`} />
                  </div>
                  <p className={`text-4xl font-extrabold ${s.color} tracking-tight`}>
                    <Counter to={s.value} prefix={s.prefix ?? ""} suffix={s.suffix} delay={i * 0.15} />
                  </p>
                  <p className="text-sm text-white/40 mt-1 font-medium">{s.label}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Testimonials ─── */}
      <section className="py-24 lg:py-32 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <p className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-4">Real creators</p>
            <h2 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
              What creators are{" "}
              <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
                building and earning
              </span>
            </h2>
            <p className="mt-4 text-lg text-white/40 max-w-xl mx-auto">
              Early access creators are already selling digital products and building audiences.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <TestimonialCard key={t.name} t={t} delay={i * 0.07} />
            ))}
          </div>

          {/* Overall rating */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4 text-center"
          >
            <div className="flex items-center gap-1.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-5 h-5 text-amber-400 fill-amber-400" />
              ))}
            </div>
            <p className="text-white/60 text-sm">
              <span className="font-bold text-white">4.9 / 5</span> from early access creators
            </p>
            <span className="hidden sm:block text-white/20">·</span>
            <p className="text-white/40 text-sm">
              Join <span className="text-white font-semibold">1,200+</span> creators in early access
            </p>
          </motion.div>
        </div>
      </section>
    </>
  );
}
