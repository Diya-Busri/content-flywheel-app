"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { ActivityFeed } from "./ActivityFeed";

export function ActivityFeedSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="py-20 lg:py-28 relative overflow-hidden">
      <div className="max-w-2xl mx-auto px-6">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white/40 mb-5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
            </span>
            Live inside the engine
          </div>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
            This is what runs every time
            <br />a product enters the flywheel.
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          <ActivityFeed />
        </motion.div>
      </div>
    </section>
  );
}
