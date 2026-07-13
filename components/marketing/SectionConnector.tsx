"use client";

import { motion } from "framer-motion";
import { ArrowDown } from "lucide-react";

/**
 * Visual thread between homepage sections — a line, a traveling pulse, and an
 * optional tiny caption tying the section transition back to the product journey.
 * Replaces plain border-t dividers so the page reads as one continuous flow.
 */
export function SectionConnector({
  label,
  icon: Icon = ArrowDown,
  className = "",
}: {
  label?: string;
  icon?: React.ElementType;
  className?: string;
}) {
  return (
    <div className={`relative flex flex-col items-center py-7 sm:py-9 ${className}`}>
      {/* Decorative thread, pulse and icon carry no information of their own —
          hidden from assistive tech so only the optional label (if any) is announced. */}
      <div aria-hidden="true" className="contents">
        {/* vertical thread */}
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />

        {/* traveling pulse — starts only once scrolled into view, so 5 of these
            don't all animate simultaneously the moment the page loads */}
        <motion.div
          className="absolute left-1/2 w-1.5 h-1.5 -ml-[3px] rounded-full bg-orange-400"
          style={{ boxShadow: "0 0 8px 2px rgba(249,115,22,0.55)" }}
          initial={{ opacity: 0 }}
          whileInView={{ top: ["6%", "94%"], opacity: [0, 1, 1, 0] }}
          viewport={{ once: true }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* icon badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="relative z-10 w-8 h-8 rounded-full bg-[#0a0a0a] border border-white/10 flex items-center justify-center"
        >
          <Icon className="w-3.5 h-3.5 text-orange-400/70" />
        </motion.div>
      </div>

      {label && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="relative z-10 mt-2.5 text-[10px] font-semibold uppercase tracking-widest text-white/30 text-center px-4"
        >
          {label}
        </motion.p>
      )}
    </div>
  );
}
