"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  Package, Search, Target, Sparkles, Layers, Video,
  Film, Mail, Rocket, Send, Zap,
} from "lucide-react";

const NODES = [
  { icon: Package, label: "Digital Product", core: true },
  { icon: Search, label: "Research" },
  { icon: Target, label: "Competitors" },
  { icon: Sparkles, label: "Hooks" },
  { icon: Layers, label: "Carousels" },
  { icon: Video, label: "TikTok Scripts" },
  { icon: Film, label: "Video Ideas" },
  { icon: Mail, label: "Email" },
  { icon: Rocket, label: "Launch Plan" },
  { icon: Send, label: "Ready to Post" },
];

const SPIN_DURATION = 50; // seconds for a full rotation
// Tuned so the wheel (radius + node badge overhang) never exceeds the viewport
// on small phones — 320px screens included. See node badge widths below.
const RADIUS = "clamp(70px, 28vw, 250px)";
const WHEEL_BUFFER = "90px";

export function FlywheelSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const n = NODES.length;

  return (
    <section id="flywheel" className="py-24 lg:py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(249,115,22,0.05),transparent_65%)] pointer-events-none" aria-hidden="true" />

      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-4">Meet the flywheel</p>
          <h2 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
            One product goes in.
            <br />
            <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
              A marketing engine comes out.
            </span>
          </h2>
          <p className="mt-4 text-lg text-white/40 max-w-xl mx-auto">
            Content Flywheel keeps spinning your product into new marketing assets, automatically.
          </p>
        </motion.div>

        {/* ─── The wheel ─── */}
        <div
          className="relative mx-auto max-w-full"
          style={{
            width: `calc(${RADIUS} * 2 + ${WHEEL_BUFFER})`,
            height: `calc(${RADIUS} * 2 + ${WHEEL_BUFFER})`,
          }}
        >
          {/* Spinning ring */}
          <motion.div
            className="absolute inset-0"
            animate={inView ? { rotate: 360 } : {}}
            transition={{ duration: SPIN_DURATION, repeat: Infinity, ease: "linear" }}
          >
            {NODES.map((node, i) => {
              const angle = (360 / n) * i - 90;
              return (
                <div
                  key={node.label}
                  className="absolute top-1/2 left-1/2"
                  style={{
                    transform: `translate(-50%, -50%) rotate(${angle}deg) translateX(${RADIUS}) rotate(${-angle}deg)`,
                  }}
                >
                  {/* Counter-spin so labels stay upright */}
                  <motion.div
                    animate={inView ? { rotate: -360 } : {}}
                    transition={{ duration: SPIN_DURATION, repeat: Infinity, ease: "linear" }}
                  >
                    <NodeBadge node={node} delay={i * 0.06} inView={inView} />
                  </motion.div>
                </div>
              );
            })}
          </motion.div>

          {/* Connecting orbit ring (visual) */}
          <div
            aria-hidden="true"
            className="absolute rounded-full border border-dashed border-white/[0.08] pointer-events-none"
            style={{
              top: "50%",
              left: "50%",
              width: `calc(${RADIUS} * 2)`,
              height: `calc(${RADIUS} * 2)`,
              transform: "translate(-50%, -50%)",
            }}
          />

          {/* Center hub */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center text-center w-28 sm:w-36">
            <motion.div
              aria-hidden="true"
              animate={inView ? { rotate: 360 } : {}}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/30 mb-2"
            >
              <Zap className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </motion.div>
            <p className="text-[11px] sm:text-xs font-bold text-white leading-tight">Content<br />Flywheel</p>
          </div>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-12 text-center text-sm text-white/30"
        >
          Every piece feeds the next. Your product never stops generating content.
        </motion.p>
      </div>
    </section>
  );
}

function NodeBadge({ node, delay, inView }: { node: (typeof NODES)[number]; delay: number; inView: boolean }) {
  const Icon = node.icon;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      animate={inView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`flex flex-col items-center gap-1.5 w-[74px] sm:w-[92px] ${node.core ? "" : ""}`}
    >
      <div
        className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center border shadow-lg ${
          node.core
            ? "bg-gradient-to-br from-orange-500 to-amber-500 border-orange-400/40 shadow-orange-500/30"
            : "bg-[#141414] border-white/10 shadow-black/40"
        }`}
      >
        <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${node.core ? "text-white" : "text-orange-400"}`} />
      </div>
      <span className={`text-[9px] sm:text-[10px] font-semibold text-center leading-tight ${node.core ? "text-white" : "text-white/50"}`}>
        {node.label}
      </span>
    </motion.div>
  );
}
