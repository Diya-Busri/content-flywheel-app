"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

const ACTIVITY_LINES = [
  "Research Generated",
  "Carousel Created",
  "TikTok Script Finished",
  "Launch Plan Ready",
  "Creator Submitted",
  "Store Published",
  "Hooks Written",
  "Email Sequence Drafted",
];

const VISIBLE_COUNT = 5;
const INTERVAL_MS = 2200;

interface FeedItem {
  id: number;
  text: string;
}

/** Ambient "the engine is working" ticker. Generic action types, not attributed to real named customers. */
export function ActivityFeed({ className = "" }: { className?: string }) {
  const [items, setItems] = useState<FeedItem[]>(() => [
    { id: 0, text: ACTIVITY_LINES[0] },
  ]);

  useEffect(() => {
    let id = 1;
    const interval = setInterval(() => {
      const text = ACTIVITY_LINES[id % ACTIVITY_LINES.length];
      setItems((prev) => [...prev, { id, text }].slice(-VISIBLE_COUNT));
      id += 1;
    }, INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.02] p-5 ${className}`}>
      <div className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
              <span className="text-xs text-white/60 font-medium">{item.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
