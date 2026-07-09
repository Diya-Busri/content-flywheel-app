"use client";

import { useEffect } from "react";
import type { OnboardingSteps } from "@/app/api/onboarding/route";

/** Call PATCH onboarding to set firstProduct when user has at least one product. */
export function SyncOnboardingSteps({ digitalProductsCount }: { digitalProductsCount: number }) {
  useEffect(() => {
    if (digitalProductsCount < 1) return;
    fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steps: { firstProduct: true } }),
    }).catch(() => {});
  }, [digitalProductsCount]);
  return null;
}

/** Call PATCH onboarding to set given steps when this component mounts (e.g. on settings page for brandProfile). */
export function SyncOnboardingStepsOnMount({ steps }: { steps: Partial<OnboardingSteps> }) {
  useEffect(() => {
    if (Object.keys(steps).length === 0) return;
    fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steps }),
    }).catch(() => {});
  }, []);
  return null;
}
