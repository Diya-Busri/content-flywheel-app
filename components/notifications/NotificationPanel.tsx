"use client";

/**
 * NotificationPanel — Phase 5.3
 * ──────────────────────────────────────────────────────────────────────────────
 * In-app notification bell for publishing events, analytics, and learning.
 *
 * Features:
 *   • Badge showing unread count on the bell icon
 *   • Drop-down panel with event-specific icons + relative timestamps
 *   • Mark all as read (single click)
 *   • Auto-polls every 30s when panel is closed
 *
 * Usage:
 *   <NotificationPanel launchId={launchId} />
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Bell, CheckCircle2, AlertTriangle, Zap, BookOpen, Flame, Brain, X, CheckCheck,
} from "lucide-react";
import type { AppNotification, NotificationEvent } from "@/db/schema/launch-schema";

/* ─── Event config ───────────────────────────────────────────────────────────── */

type EventConfig = {
  icon:       React.ReactNode;
  color:      string;
  bg:         string;
};

const EVENT_CONFIG: Record<NotificationEvent, EventConfig> = {
  publish_success:    { icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "text-green-400",  bg: "bg-green-500/10"  },
  publish_failed:     { icon: <AlertTriangle className="w-3.5 h-3.5" />, color: "text-red-400",   bg: "bg-red-500/10"    },
  analytics_complete: { icon: <Zap className="w-3.5 h-3.5" />,          color: "text-blue-400",   bg: "bg-blue-500/10"   },
  new_lesson:         { icon: <BookOpen className="w-3.5 h-3.5" />,     color: "text-purple-400", bg: "bg-purple-500/10" },
  viral_post:         { icon: <Flame className="w-3.5 h-3.5" />,        color: "text-orange-400", bg: "bg-orange-500/10" },
  learning_complete:  { icon: <Brain className="w-3.5 h-3.5" />,        color: "text-emerald-400",bg: "bg-emerald-500/10"},
};

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/* ─── Props ──────────────────────────────────────────────────────────────────── */

interface Props {
  launchId: string;
}

/* ─── Component ──────────────────────────────────────────────────────────────── */

export function NotificationPanel({ launchId }: Props) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [open,          setOpen]          = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  /* ── Fetch ──────────────────────────────────────────────────────────────── */
  const fetchNotifs = useCallback(async () => {
    try {
      const res  = await fetch(`/api/projects/${launchId}/notifications`);
      const json = await res.json() as { notifications: AppNotification[]; unreadCount: number };
      setNotifications(json.notifications ?? []);
      setUnreadCount(json.unreadCount ?? 0);
    } catch { /* silent */ }
  }, [launchId]);

  /* ── Poll every 30s when panel is closed ─────────────────────────────────── */
  useEffect(() => {
    fetchNotifs();
    const id = setInterval(() => { if (!open) fetchNotifs(); }, 30_000);
    return () => clearInterval(id);
  }, [fetchNotifs, open]);

  /* ── Fetch on open ───────────────────────────────────────────────────────── */
  useEffect(() => {
    if (open) fetchNotifs();
  }, [open, fetchNotifs]);

  /* ── Click outside to close ──────────────────────────────────────────────── */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  /* ── Mark all read ───────────────────────────────────────────────────────── */
  const markAllRead = useCallback(async () => {
    try {
      await fetch(`/api/projects/${launchId}/notifications`, { method: "PATCH" });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch { /* silent */ }
  }, [launchId]);

  return (
    <div className="relative" ref={panelRef}>
      {/* ── Bell button ── */}
      <button
        onClick={() => setOpen(p => !p)}
        className={[
          "relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors",
          open ? "bg-muted/30 text-foreground" : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/20",
        ].join(" ")}
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-orange-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* ── Panel ── */}
      {open && (
        <div className="absolute right-0 top-10 w-80 rounded-2xl border border-border/60 bg-card shadow-xl z-50 overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
            <div className="flex items-center gap-2">
              <Bell className="w-3.5 h-3.5 text-muted-foreground/60" />
              <span className="text-[12px] font-bold text-foreground">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400 text-[9px] font-bold">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-muted-foreground/60 hover:text-foreground hover:bg-muted/20 transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3 h-3" />
                  Mark read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-muted/20 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto divide-y divide-border/20">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-[12px] text-muted-foreground/40">No notifications yet</p>
                <p className="text-[10px] text-muted-foreground/30 mt-1">
                  Publish content to start receiving updates
                </p>
              </div>
            ) : (
              notifications.map(notif => {
                const cfg = EVENT_CONFIG[notif.event] ?? EVENT_CONFIG.analytics_complete;
                return (
                  <a
                    key={notif.id}
                    href={notif.href}
                    onClick={() => setOpen(false)}
                    className={[
                      "flex items-start gap-3 px-4 py-3 hover:bg-muted/10 transition-colors",
                      notif.read ? "opacity-60" : "",
                    ].join(" ")}
                  >
                    {/* Icon */}
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${cfg.bg} ${cfg.color}`}>
                      {cfg.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-[11px] font-bold leading-snug ${notif.read ? "text-muted-foreground/60" : "text-foreground"}`}>
                          {notif.title}
                        </p>
                        {!notif.read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5 leading-relaxed">
                        {notif.message}
                      </p>
                      <p className="text-[9px] text-muted-foreground/30 mt-1">
                        {relTime(notif.createdAt)}
                      </p>
                    </div>
                  </a>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
