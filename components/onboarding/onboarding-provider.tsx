"use client";

import { useState, useEffect, useCallback } from "react";
import { OnboardingModal } from "@/components/onboarding/onboarding-modal";
import { OnboardingChecklist } from "@/components/onboarding/onboarding-checklist";
import type { OnboardingSteps } from "@/app/api/onboarding/route";

type OnboardingProviderProps = {
  children: React.ReactNode;
  /** When true, mark exploreDashboard and createAccount as done (user is on dashboard) */
  markDashboardSeen?: boolean;
  /** When true, mark firstProduct as done */
  hasProduct?: boolean;
};

export function OnboardingProvider({
  children,
  markDashboardSeen = false,
  hasProduct = false,
}: OnboardingProviderProps) {
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [steps, setSteps] = useState<OnboardingSteps | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOnboarding = useCallback(async () => {
    try {
      const res = await fetch("/api/onboarding");
      const data = await res.json();
      if (res.ok) {
        setOnboardingCompleted(data.onboardingCompleted === true);
        setSteps(data.onboardingSteps ?? {});
      }
    } catch {
      setOnboardingCompleted(false);
      setSteps({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOnboarding();
  }, [fetchOnboarding]);

  // Mark steps when dashboard is seen or user has a product (only when something new to set)
  useEffect(() => {
    if (loading || onboardingCompleted || steps === null) return;
    const updates: Partial<OnboardingSteps> = {};
    if (markDashboardSeen && !steps.createAccount) updates.createAccount = true;
    if (markDashboardSeen && !steps.exploreDashboard) updates.exploreDashboard = true;
    if (hasProduct && !steps.firstProduct) updates.firstProduct = true;
    if (Object.keys(updates).length === 0) return;
    const next = { ...steps, ...updates };
    setSteps(next);
    fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steps: next }),
    }).catch(() => {});
  }, [loading, markDashboardSeen, hasProduct, onboardingCompleted, steps]);

  const handleModalComplete = useCallback(() => {
    setSteps((prev) => ({ ...prev, modalDismissed: true }));
    fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        steps: {
          ...steps,
          modalDismissed: true,
          createAccount: true,
          exploreDashboard: true,
        },
      }),
    }).then(() => fetchOnboarding()).catch(() => {});
  }, [steps, fetchOnboarding]);

  const showModal = !loading && !onboardingCompleted && steps?.modalDismissed !== true;

  const handleStepComplete = useCallback((step: number) => {
    if (step === 2) {
      setSteps((prev) => ({ ...prev, watchDemo: true }));
      fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps: { ...steps, watchDemo: true } }),
      }).catch(() => {});
    }
  }, [steps]);

  return (
    <>
      <OnboardingModal show={showModal} onComplete={handleModalComplete} onStepComplete={handleStepComplete} />
      {children}
      {!loading && !onboardingCompleted && (
        <div className="fixed bottom-6 right-6 z-40 w-80 max-w-[calc(100vw-3rem)]">
          <OnboardingChecklist steps={steps} />
        </div>
      )}
    </>
  );
}
