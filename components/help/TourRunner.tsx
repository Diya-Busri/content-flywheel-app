"use client";

/**
 * TourRunner — mounts on every dashboard page.
 * Reads tour state from localStorage and auto-runs the correct page tour,
 * then navigates to the next page when done, chaining all pages together.
 */

import { useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PAGE_TOURS, getPageTours } from "./tour-steps";

const TOUR_KEY = "cf_full_tour";

export type TourState = {
  active: boolean;
  pageIndex: number;
};

export function saveTourState(state: TourState) {
  try { localStorage.setItem(TOUR_KEY, JSON.stringify(state)); } catch {}
}

export function clearTourState() {
  try { localStorage.removeItem(TOUR_KEY); } catch {}
}

export function getTourState(): TourState | null {
  try {
    const raw = localStorage.getItem(TOUR_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TourState;
  } catch { return null; }
}

/** Start the full app tour from page index 0 */
export function startFullAppTour(router: ReturnType<typeof useRouter>) {
  saveTourState({ active: true, pageIndex: 0 });
  const firstPage = PAGE_TOURS[0]?.page ?? "/dashboard";
  // Dispatch custom event so TourRunner picks it up even if already on the page
  window.dispatchEvent(new CustomEvent("cf:start-tour"));
  // Also navigate in case we're not on the first page
  router.push(firstPage);
}

// ─── TourRunner component ─────────────────────────────────────────────────────

function runPageTour(pageIndex: number, pageTour: typeof PAGE_TOURS[number], router: ReturnType<typeof useRouter>, isMobile: boolean) {
  return new Promise<void>((resolve) => {
    const tours = getPageTours(isMobile);
    import("driver.js").then(async ({ driver }) => {
      await import("driver.js/dist/driver.css");

      const isLastPage = pageIndex >= tours.length - 1;
      let navigatedAway = false; // prevent double-clear when d.destroy() fires onDestroyStarted

      const d = driver({
        showProgress: true,
        animate: true,
        overlayOpacity: 0.6,
        smoothScroll: true,
        allowClose: true,
        nextBtnText: "Next →",
        prevBtnText: "← Back",
        doneBtnText: isLastPage ? "Finish Tour ✓" : "Next Page →",
        onDestroyStarted: () => {
          d.destroy();
          // Only clear if user pressed X (not if we navigated programmatically)
          if (!navigatedAway) {
            clearTourState();
          }
          resolve();
        },
        steps: pageTour.steps.map((step, stepIdx) => {
          const isLastStep = stepIdx === pageTour.steps.length - 1;
          return {
            element: step.element,
            popover: {
              title: step.title,
              description: step.description,
              side: step.side ?? "bottom",
              align: "start",
              ...(isLastStep && {
                nextBtnText: isLastPage ? "Finish Tour ✓" : `Next: ${PAGE_TOURS[pageIndex + 1]?.label ?? "Next"} →`,
                onNextClick: () => {
                  navigatedAway = true;
                  d.destroy();
                  if (isLastPage) {
                    clearTourState();
                    // Ask if they want a live demo walkthrough
                    setTimeout(() => {
                      window.dispatchEvent(new CustomEvent("cf:tour-complete"));
                    }, 400);
                  } else {
                    const nextIndex = pageIndex + 1;
                    saveTourState({ active: true, pageIndex: nextIndex });
                    router.push(tours[nextIndex]!.page);
                  }
                  resolve();
                },
              }),
            },
          };
        }),
      });

      d.drive();
    }).catch(() => {
      clearTourState();
      resolve();
    });
  });
}

export function TourRunner() {
  const pathname = usePathname();
  const router = useRouter();
  const hasRun = useRef(false);
  const prevPathname = useRef<string | null>(null);

  // Reset hasRun whenever the page changes so each page gets its own tour
  if (prevPathname.current !== pathname) {
    prevPathname.current = pathname;
    hasRun.current = false;
  }

  const tryRunTour = useCallback(() => {
    if (hasRun.current) return;

    const state = getTourState();
    if (!state?.active) return;

    const { pageIndex } = state;
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    const tours = getPageTours(isMobile);
    const pageTour = tours[pageIndex];
    if (!pageTour) { clearTourState(); return; }

    // Check if we're on the right page
    const onCorrectPage =
      pathname === pageTour.page ||
      (pageTour.page !== "/dashboard" && pathname.startsWith(pageTour.page));

    if (!onCorrectPage) {
      router.push(pageTour.page);
      return;
    }

    hasRun.current = true;

    // Small delay to let the page finish rendering, then guard on subscription
    const tid = setTimeout(() => {
      fetch("/api/payment-status")
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (!data?.hasActiveSubscription) { clearTourState(); return; }
          runPageTour(pageIndex, pageTour, router, isMobile);
        })
        .catch(() => { clearTourState(); });
    }, 800);

    return tid;
  }, [pathname, router]);

  // Listen for the cf:start-tour event (fired when already on the target page)
  useEffect(() => {
    const handleStartEvent = () => {
      hasRun.current = false;
      tryRunTour();
    };
    window.addEventListener("cf:start-tour", handleStartEvent);
    return () => window.removeEventListener("cf:start-tour", handleStartEvent);
  }, [tryRunTour]);

  useEffect(() => {
    const tid = tryRunTour();
    return () => { if (tid) clearTimeout(tid); };
  }, [tryRunTour]);

  return null;
}
