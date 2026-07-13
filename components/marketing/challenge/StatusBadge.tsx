"use client";

import { motion } from "framer-motion";
import type { EpisodeStatus } from "@/lib/marketing-challenge";

const CONFIG: Record<EpisodeStatus, { label: string; dot: string; text: string; bg: string; border: string; pulse: boolean }> = {
  live: { label: "Live", dot: "bg-red-500", text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", pulse: true },
  coming_soon: { label: "Coming Soon", dot: "bg-amber-400", text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", pulse: false },
  complete: { label: "Complete", dot: "bg-green-400", text: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30", pulse: false },
};

export function StatusBadge({ status, size = "sm" }: { status: EpisodeStatus; size?: "xs" | "sm" }) {
  const c = CONFIG[status];
  const pad = size === "xs" ? "px-2 py-0.5 text-[9px]" : "px-3 py-1 text-[10px]";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${c.border} ${c.bg} ${c.text} font-bold uppercase tracking-wide ${pad}`}>
      <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
        {c.pulse && (
          <motion.span
            className={`absolute inline-flex h-full w-full rounded-full ${c.dot} opacity-75`}
            animate={{ scale: [1, 1.8], opacity: [0.75, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${c.dot}`} />
      </span>
      {c.label}
    </span>
  );
}
