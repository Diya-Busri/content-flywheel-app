"use client";

import { useEffect, useState } from "react";

function getParts(target: Date) {
  const diff = Math.max(0, target.getTime() - Date.now());
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { days, hours, minutes, seconds };
}

/** Live countdown to a target Date. Target is always computed by the caller, never hardcoded. */
export function CountdownTimer({
  target,
  label,
  className = "",
}: {
  target: Date;
  /** Optional caption shown under the digits, e.g. "Until the spotlight opens". */
  label?: string;
  className?: string;
}) {
  const [parts, setParts] = useState(() => getParts(target));

  useEffect(() => {
    const id = setInterval(() => setParts(getParts(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  const units: { unit: string; value: number }[] = [
    { unit: "days", value: parts.days },
    { unit: "hrs", value: parts.hours },
    { unit: "min", value: parts.minutes },
    { unit: "sec", value: parts.seconds },
  ];

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      {/* A single static, accessible description — the ticking digits below are hidden from
          assistive tech so screen readers aren't interrupted every second. */}
      <div
        role="timer"
        aria-label={`Counting down to ${target.toLocaleDateString(undefined, { weekday: "long", hour: "numeric", minute: "2-digit" })}`}
        className="flex items-center gap-2"
      >
        {units.map((u) => (
          <div key={u.unit} className="flex flex-col items-center" aria-hidden="true">
            <div className="w-11 sm:w-12 rounded-lg bg-white/[0.05] border border-white/10 py-1.5 text-center">
              <span className="text-sm sm:text-base font-bold text-white tabular-nums">
                {String(u.value).padStart(2, "0")}
              </span>
            </div>
            <span className="text-[9px] text-white/35 uppercase tracking-wide mt-1">{u.unit}</span>
          </div>
        ))}
      </div>
      {label && (
        <p className="text-[10px] text-white/30 uppercase tracking-widest text-center">{label}</p>
      )}
    </div>
  );
}
