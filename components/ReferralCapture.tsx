"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Invisible component — reads ?ref= from URL on first dashboard visit
 * and saves it to the referrals table. Runs once, then exits.
 */
export function ReferralCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (!ref) return;
    // Fire-and-forget, non-critical
    void fetch("/api/referral/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referrerId: ref }),
    });
  }, [searchParams]);

  return null;
}
