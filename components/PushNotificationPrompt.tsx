"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, X } from "lucide-react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

type PermState = "default" | "granted" | "denied" | "unsupported";

export function PushNotificationPrompt() {
  const [permState, setPermState] = useState<PermState>("default");
  const [dismissed, setDismissed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !VAPID_PUBLIC_KEY) {
      setPermState("unsupported");
      return;
    }
    setPermState(Notification.permission as PermState);

    // If already granted, silently ensure subscription is registered
    if (Notification.permission === "granted") {
      ensureSubscribed().catch(() => {});
    }
  }, []);

  async function ensureSubscribed() {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) return; // already subscribed

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    const json = sub.toJSON();
    const keys = json.keys as { p256dh: string; auth: string };
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: json.endpoint, p256dh: keys.p256dh, auth: keys.auth }),
    });
  }

  async function requestPermission() {
    if (!VAPID_PUBLIC_KEY) return;
    setSubscribing(true);
    try {
      const result = await Notification.requestPermission();
      setPermState(result as PermState);
      if (result === "granted") {
        await ensureSubscribed();
        setDismissed(true); // hide prompt after successful grant
      }
    } catch (err) {
      console.error("Push subscribe error:", err);
    }
    setSubscribing(false);
  }

  // Don't render server-side, or if unsupported/already decided/dismissed
  if (!mounted) return null;
  if (permState === "unsupported" || permState === "denied" || permState === "granted") return null;
  if (dismissed) return null;

  return (
    <div className="mx-3 mb-3 rounded-xl border border-orange-500/25 bg-orange-500/8 p-3">
      <div className="flex items-start gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-orange-500/15 flex items-center justify-center shrink-0 mt-0.5">
          <Bell className="w-3.5 h-3.5 text-orange-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground leading-snug mb-0.5">Get sale alerts</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">Know the instant you make a sale — even when you&apos;re not here.</p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={requestPermission}
              disabled={subscribing}
              className="flex items-center gap-1 text-[11px] font-semibold bg-orange-500 hover:bg-orange-600 text-white px-2.5 py-1 rounded-lg transition-colors disabled:opacity-60"
            >
              {subscribing ? "Enabling…" : "Enable notifications"}
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="text-[11px] text-muted-foreground hover:text-foreground px-1.5 py-1 rounded-lg transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="text-muted-foreground/50 hover:text-muted-foreground shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// Status indicator for settings page
export function PushNotificationStatus() {
  const [permState, setPermState] = useState<PermState>("default");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!("Notification" in window)) { setPermState("unsupported"); return; }
    setPermState(Notification.permission as PermState);
  }, []);

  async function disable() {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
    setPermState("denied");
  }

  if (!mounted || permState === "unsupported") return null;

  return (
    <div className="flex items-center gap-3">
      <div className={`w-2 h-2 rounded-full ${permState === "granted" ? "bg-green-500" : "bg-gray-400"}`} />
      <span className="text-sm text-muted-foreground">
        Push notifications: <strong className={permState === "granted" ? "text-green-500" : "text-foreground"}>{permState === "granted" ? "Enabled" : "Not enabled"}</strong>
      </span>
      {permState === "granted" && (
        <button onClick={disable} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 border border-border hover:border-red-500/30 px-2 py-1 rounded-lg transition-all">
          <BellOff className="w-3 h-3" /> Disable
        </button>
      )}
    </div>
  );
}
