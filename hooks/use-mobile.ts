"use client";

import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT_QUERY = "(max-width: 767px)"; // matches Tailwind's `md` breakpoint (768px)

/**
 * Reusable mobile/desktop layout hook. Not tied to any one feature —
 * intentionally generic (matches Tailwind's `md` breakpoint) so other
 * components can reuse it instead of each rolling their own matchMedia logic.
 *
 * Consumers that only need this to pick a layout for something opened in
 * response to a user action (e.g. a sheet/panel triggered by a click) avoid
 * any hydration mismatch by construction — the value is only read after
 * mount, never during the initial server-rendered paint.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches : false
  );

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_BREAKPOINT_QUERY);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
