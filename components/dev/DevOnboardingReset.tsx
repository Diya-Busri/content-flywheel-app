"use client";

/**
 * Admin-only floating button to reset onboarding state for testing.
 * Only renders for the admin account (isAdmin=true).
 */
export function DevOnboardingReset({ isAdmin }: { isAdmin?: boolean }) {
  if (!isAdmin) return null;

  const reset = async () => {
    await fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reset: true }),
    });
    window.location.reload();
  };

  const restore = async () => {
    await fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        steps: {
          modalDismissed: true,
          createAccount: true,
          brandProfile: true,
          firstProduct: true,
          exploreDashboard: true,
          watchDemo: true,
        },
        onboardingCompleted: true,
      }),
    });
    window.location.reload();
  };

  return (
    <div className="fixed top-20 right-6 z-[200] hidden md:flex flex-col gap-2">
      <button
        type="button"
        onClick={reset}
        className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-3 py-2 rounded-lg shadow-lg"
      >
        🧪 Test Wizard
      </button>
      <button
        type="button"
        onClick={restore}
        className="bg-slate-600 hover:bg-slate-700 text-white text-xs font-semibold px-3 py-2 rounded-lg shadow-lg"
      >
        ↩ Restore
      </button>
    </div>
  );
}
