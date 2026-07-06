"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { usePathname } from "next/navigation";
import confetti from "canvas-confetti";
import { OnboardingModal } from "@/components/onboarding/onboarding-modal";
import { OnboardingChecklist } from "@/components/onboarding/onboarding-checklist";
import type { OnboardingSteps } from "@/app/api/onboarding/route";

type OnboardingContextValue = { modalActive: boolean };
const OnboardingContext = createContext<OnboardingContextValue>({ modalActive: false });
export function useOnboarding() { return useContext(OnboardingContext); }

const BRAND_ORANGE = "#F59E0B";

function fireOnboardingConfetti() {
  try {
    const colors = [BRAND_ORANGE, "#FBBF24", "#FCD34D", "#FDE68A", "#FEF3C7", "#FFFFFF"];
    const opts = { origin: { y: 0.6 }, zIndex: 9999, colors };
    confetti({ ...opts, particleCount: 120, spread: 100 });
    confetti({ ...opts, particleCount: 80, angle: 55, spread: 75 });
    confetti({ ...opts, particleCount: 80, angle: 125, spread: 75 });
    confetti({ ...opts, particleCount: 60, angle: 90, spread: 60, startVelocity: 35 });
  } catch {
    // ignore
  }
}

type OnboardingProviderProps = {
  children: React.ReactNode;
  /** When true, mark exploreDashboard and createAccount as done (user is on dashboard) */
  markDashboardSeen?: boolean;
  /** When true, mark firstProduct as done */
  hasProduct?: boolean;
  /** When false, suppress the welcome modal until billing is complete */
  hasActiveSubscription?: boolean;
};

export function OnboardingProvider({
  children,
  markDashboardSeen = false,
  hasProduct = false,
  hasActiveSubscription = false,
}: OnboardingProviderProps) {
  const pathname = usePathname();
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [steps, setSteps] = useState<OnboardingSteps | null>(null);
  const [enabledFeatures, setEnabledFeatures] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOnboarding = useCallback(async () => {
    try {
      // Fetch onboarding status + user's selected features in parallel
      const [onboardingRes, featuresRes] = await Promise.all([
        fetch("/api/onboarding"),
        fetch("/api/user-features"),
      ]);
      const onboardingData = await onboardingRes.json();
      const featuresData = await featuresRes.json();
      if (onboardingRes.ok) {
        setOnboardingCompleted(onboardingData.onboardingCompleted === true);
        setSteps(onboardingData.onboardingSteps ?? {});
      }
      if (featuresRes.ok) {
        setEnabledFeatures(featuresData.enabledFeatures ?? null);
      }
    } catch {
      setOnboardingCompleted(false);
      setSteps({});
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchOnboarding();
  }, [fetchOnboarding]);

  // Re-fetch on every route change — picks up changes made on other pages
  // (e.g. settings page marks brandProfile done; we catch it when user navigates away)
  useEffect(() => {
    if (!loading) {
      fetchOnboarding();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Mark steps when dashboard is seen, user has a product, or digital products wasn't selected
  useEffect(() => {
    if (loading || onboardingCompleted || steps === null) return;
    const updates: Partial<OnboardingSteps> = {};
    if (markDashboardSeen && !steps.createAccount) updates.createAccount = true;
    if (markDashboardSeen && !steps.exploreDashboard) updates.exploreDashboard = true;
    if (hasProduct && !steps.firstProduct) updates.firstProduct = true;
    // If user didn't select "digital_products" during onboarding, auto-complete firstProduct
    // so it doesn't block overall completion and isn't shown in the checklist
    if (
      enabledFeatures !== null &&
      !enabledFeatures.includes("digital_products") &&
      !steps.firstProduct
    ) {
      updates.firstProduct = true;
    }
    if (Object.keys(updates).length === 0) return;
    const next = { ...steps, ...updates };
    setSteps(next);
    fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steps: next }),
    }).catch(() => {});
  }, [loading, markDashboardSeen, hasProduct, onboardingCompleted, steps, enabledFeatures]);

  const handleModalComplete = useCallback(() => {
    try {
      fireOnboardingConfetti();
      setSteps((prev) => ({ ...(prev ?? {}), modalDismissed: true }));
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
      })
        .then(() => fetchOnboarding())
        .catch((err) => console.error("[OnboardingProvider] PATCH onboarding:", err));
    } catch (err) {
      console.error("[OnboardingProvider] handleModalComplete:", err);
    }
  }, [steps, fetchOnboarding]);

  const showModal = !loading && !onboardingCompleted && steps?.modalDismissed !== true && hasActiveSubscription;

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
    <OnboardingContext.Provider value={{ modalActive: showModal }}>
      <OnboardingModal show={showModal} onComplete={handleModalComplete} onStepComplete={handleStepComplete} />
      {children}
      {!loading && !onboardingCompleted && !showModal && (
        <div className="fixed bottom-6 right-6 z-40 w-80 max-w-[calc(100vw-3rem)]">
          <OnboardingChecklist steps={steps} enabledFeatures={enabledFeatures} onStepsChange={fetchOnboarding} />
        </div>
      )}
    </OnboardingContext.Provider>
  );
}
