"use client";

import { useState, useEffect } from "react";
import { X, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: string;
  linkUrl?: string | null;
  linkLabel?: string | null;
}

function typeBg(type: string) {
  switch (type) {
    case "warning": return "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800/40 text-yellow-800 dark:text-yellow-200";
    case "success": return "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/40 text-green-800 dark:text-green-200";
    case "promo": return "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/40 text-orange-800 dark:text-orange-200";
    default: return "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/40 text-blue-800 dark:text-blue-200";
  }
}

function typeEmoji(type: string) {
  switch (type) {
    case "warning": return "⚠️";
    case "success": return "✅";
    case "promo": return "🎉";
    default: return "📢";
  }
}

const DISMISSED_KEY = "dismissed_announcements";

export function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const stored = localStorage.getItem(DISMISSED_KEY);
    if (stored) {
      try { setDismissed(new Set(JSON.parse(stored))); } catch {}
    }
    fetch("/api/announcements")
      .then(r => r.json())
      .then(d => setAnnouncements(d.announcements || []))
      .catch(() => {});
  }, []);

  function dismiss(id: string) {
    setDismissed(prev => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  const visible = announcements.filter(a => !dismissed.has(a.id));

  return (
    <AnimatePresence>
      {visible.map((a) => (
        <motion.div
          key={a.id}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className={`flex items-center gap-3 px-4 py-2.5 border-b text-sm ${typeBg(a.type)}`}
        >
          <span className="text-base">{typeEmoji(a.type)}</span>
          <div className="flex-1 min-w-0">
            <span className="font-semibold mr-1.5">{a.title}</span>
            <span className="opacity-80">{a.message}</span>
            {a.linkUrl && (
              <a href={a.linkUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 ml-2 font-semibold underline hover:no-underline">
                {a.linkLabel || "Learn more"} <ExternalLink size={12} />
              </a>
            )}
          </div>
          <button onClick={() => dismiss(a.id)} className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity" aria-label="Dismiss">
            <X size={16} />
          </button>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
