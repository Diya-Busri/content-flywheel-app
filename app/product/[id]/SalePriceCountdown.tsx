"use client";

import { useEffect, useState } from "react";

interface SalePriceCountdownProps {
  productId: string;
  /** Duration in hours before the "sale" expires (resets on first visit) */
  durationHours?: number;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function SalePriceCountdown({ productId, durationHours = 24 }: SalePriceCountdownProps) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    const key = `sale_deadline_${productId}`;
    let deadline = parseInt(localStorage.getItem(key) ?? "0", 10);
    const now = Date.now();

    // Set deadline if not already set or if it's expired
    if (!deadline || deadline <= now) {
      deadline = now + durationHours * 60 * 60 * 1000;
      localStorage.setItem(key, String(deadline));
    }

    const tick = () => {
      const remaining = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        // Reset for next visit
        localStorage.removeItem(key);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [productId, durationHours]);

  if (secondsLeft === null || secondsLeft <= 0) return null;

  const h = Math.floor(secondsLeft / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = secondsLeft % 60;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "6px 12px",
        borderRadius: "8px",
        background: "#fff1f2",
        border: "1px solid #fecdd3",
        marginTop: "8px",
      }}
    >
      <span style={{ fontSize: "13px" }}>⏰</span>
      <span style={{ fontSize: "12px", fontWeight: 700, color: "#be123c" }}>
        Sale ends in&nbsp;
      </span>
      <span style={{ fontSize: "13px", fontWeight: 800, color: "#be123c", fontVariantNumeric: "tabular-nums", letterSpacing: "0.03em" }}>
        {pad(h)}:{pad(m)}:{pad(s)}
      </span>
    </div>
  );
}
