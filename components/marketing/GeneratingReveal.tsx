"use client";

import { motion } from "framer-motion";

/**
 * Reveals its children as if the AI just finished writing them — a left-to-right
 * sweep rather than a plain fade. Used anywhere we show "generated" copy so it
 * reads as output from a working engine, not static text.
 */
export function GeneratingReveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ clipPath: "inset(0 100% 0 0)" }}
      whileInView={{ clipPath: "inset(0 0% 0 0)" }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.65, delay, ease: [0.65, 0, 0.35, 1] }}
      className={`relative ${className}`}
    >
      {children}
    </motion.div>
  );
}
