"use client";

import { motion, useScroll, useSpring } from "framer-motion";

/** Thin fixed progress bar across the top of the viewport — the "engine is running" HUD element. */
export function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 26, mass: 0.2 });

  return (
    <motion.div
      style={{ scaleX }}
      className="fixed top-0 left-0 right-0 h-[2px] origin-left bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500 z-[60] pointer-events-none"
      aria-hidden="true"
    />
  );
}
