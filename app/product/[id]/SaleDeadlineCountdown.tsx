"use client";

import { useEffect, useState } from "react";

interface SaleDeadlineCountdownProps {
  endsAt: string; // ISO date string
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function SaleDeadlineCountdown({ endsAt }: SaleDeadlineCountdownProps) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    const deadline = new Date(endsAt).getTime();

    const tick = () => {
      const remaining = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  if (secondsLeft === null) return null;

  if (secondsLeft <= 0) {
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "8px", background: "#fef2f2", border: "1px solid #fecaca", marginTop: "8px" }}>
        <span style={{ fontSize: "13px" }}>🔒</span>
        <span style={{ fontSize: "12px", fontWeight: 700, color: "#dc2626" }}>This offer has closed</span>
      </div>
    );
  }

  const d = Math.floor(secondsLeft / 86400);
  const h = Math.floor((secondsLeft % 86400) / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = secondsLeft % 60;

  const parts = d > 0
    ? `${d}d ${pad(h)}h ${pad(m)}m`
    : `${pad(h)}:${pad(m)}:${pad(s)}`;

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "8px", background: "#fff1f2", border: "1px solid #fecdd3", marginTop: "8px" }}>
      <span style={{ fontSize: "13px" }}>⏳</span>
      <span style={{ fontSize: "12px", fontWeight: 700, color: "#be123c" }}>
        Closes in&nbsp;<span style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "0.03em" }}>{parts}</span>
      </span>
    </div>
  );
}
