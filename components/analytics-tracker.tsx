"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";

function detectDevice(): string {
  const ua = navigator.userAgent;
  if (/mobile/i.test(ua) && !/tablet|ipad/i.test(ua)) return "mobile";
  if (/tablet|ipad/i.test(ua)) return "tablet";
  return "desktop";
}

function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (/edg\//i.test(ua)) return "Edge";
  if (/opr\//i.test(ua)) return "Opera";
  if (/chrome/i.test(ua)) return "Chrome";
  if (/safari/i.test(ua)) return "Safari";
  if (/firefox/i.test(ua)) return "Firefox";
  return "Other";
}

export function AnalyticsTracker() {
  const { user, isLoaded } = useUser();
  const pathname = usePathname();
  const initialized = useRef(false);
  const sessionId = useRef<string | null>(null);
  const startedAt = useRef(0);

  // Initialize once after Clerk loads
  useEffect(() => {
    if (!isLoaded || initialized.current) return;
    initialized.current = true;

    let sid = sessionStorage.getItem("cf_sid");
    const isNew = !localStorage.getItem("cf_rv");
    if (!sid) {
      sid = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem("cf_sid", sid);
    }
    if (isNew) localStorage.setItem("cf_rv", "1");

    sessionId.current = sid;
    startedAt.current = Date.now();

    void fetch("/api/analytics/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sid,
        userId: user?.id ?? null,
        entryPage: pathname,
        device: detectDevice(),
        browser: detectBrowser(),
        referrer: document.referrer || null,
        isNew,
      }),
    });

    // Heartbeat every 30s to keep session alive + update duration
    const interval = setInterval(() => {
      if (!sessionId.current) return;
      void fetch("/api/analytics/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId.current,
          durationSeconds: Math.round((Date.now() - startedAt.current) / 1000),
        }),
      });
    }, 30_000);

    // Final duration update when tab closes
    const handleUnload = () => {
      if (!sessionId.current) return;
      navigator.sendBeacon(
        "/api/analytics/session",
        new Blob(
          [JSON.stringify({ sessionId: sessionId.current, durationSeconds: Math.round((Date.now() - startedAt.current) / 1000) })],
          { type: "application/json" },
        ),
      );
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  // Track page navigation
  useEffect(() => {
    if (!sessionId.current) return;
    void fetch("/api/analytics/session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sessionId.current, newPage: pathname }),
    });
  }, [pathname]);

  return null;
}
