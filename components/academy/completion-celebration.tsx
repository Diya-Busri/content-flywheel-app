"use client";

import { useEffect } from "react";

/** Fires a confetti burst once on mount. Uses canvas-confetti (already installed). */
export function CompletionCelebration() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const confetti = (await import("canvas-confetti")).default;
        if (cancelled) return;
        const fire = (particleRatio: number, opts: Record<string, unknown>) =>
          confetti({
            origin: { y: 0.7 },
            particleCount: Math.floor(200 * particleRatio),
            ...opts,
          });
        fire(0.25, { spread: 26, startVelocity: 55 });
        fire(0.2, { spread: 60 });
        fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
        fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
        fire(0.1, { spread: 120, startVelocity: 45 });
      } catch {
        /* confetti is best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
