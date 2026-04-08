"use client";

import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  linkUrl?: string | null;
  createdAt: string;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unread = notifications.filter(n => !n.read).length;

  async function fetchNotifications() {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // poll every minute
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ readAll: true }) });
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  async function markRead(id: string) {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }

  function typeColor(type: string) {
    switch (type) {
      case "success": return "bg-green-500";
      case "warning": return "bg-yellow-500";
      case "error": return "bg-red-500";
      default: return "bg-blue-500";
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(o => !o); if (!open) fetchNotifications(); }}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10 hover:text-gray-700 dark:hover:text-white transition-colors"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-orange-500 text-white rounded-full">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-10 z-50 w-80 rounded-xl border border-[#E5E7EB] dark:border-white/10 bg-white dark:bg-card shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB] dark:border-white/10">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</span>
              {unread > 0 && (
                <button onClick={markAllRead} className="text-xs text-orange-500 hover:underline">Mark all read</button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-[#E5E7EB] dark:divide-white/10">
              {loading && notifications.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-gray-400">Loading...</div>
              ) : notifications.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-gray-400">No notifications yet</div>
              ) : (
                notifications.map(n => (
                  <div
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className={`flex gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-black/5 dark:hover:bg-white/5 ${!n.read ? "bg-orange-500/5" : ""}`}
                  >
                    <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${typeColor(n.type)} ${n.read ? "opacity-30" : ""}`} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium truncate ${n.read ? "text-gray-500 dark:text-gray-400" : "text-gray-900 dark:text-white"}`}>{n.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.message}</p>
                      {n.linkUrl && (
                        <a href={n.linkUrl} className="text-xs text-orange-500 hover:underline mt-1 inline-block">View →</a>
                      )}
                      <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
