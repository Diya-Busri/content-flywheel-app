"use client";

/**
 * OnboardingTrigger — auto-starts the full app tour the first time
 * a user lands on the dashboard. Uses localStorage so it only fires once
 * per browser (won't repeat on every login).
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { startFullAppTour, getTourState } from "./TourRunner";

const ONBOARDING_KEY = "cf_onboarding_done";

export function markOnboardingDone() {
  try { localStorage.setItem(ONBOARDING_KEY, "1"); } catch {}
}

export function hasSeenOnboarding() {
  try { return !!localStorage.getItem(ONBOARDING_KEY); } catch { return false; }
}

/** Call this before manually starting the tour so it doesn't retrigger on next load */
export function resetOnboarding() {
  try { localStorage.removeItem(ONBOARDING_KEY); } catch {}
}

export function OnboardingTrigger() {
  const router = useRouter();
  const { isSignedIn } = useAuth();

  useEffect(() => {
    // Only trigger for authenticated users — prevents redirecting landing page visitors
    if (!isSignedIn) return;

    // Don't interrupt if a tour is already in progress
    const existing = getTourState();
    if (existing?.active) return;

    if (hasSeenOnboarding()) return;

    // Mark immediately so a fast refresh doesn't double-trigger
    markOnboardingDone();

    // Short delay so the dashboard fully renders before the tour starts
    const tid = setTimeout(() => {
      startFullAppTour(router);
    }, 1800);

    return () => clearTimeout(tid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  return null;
}
