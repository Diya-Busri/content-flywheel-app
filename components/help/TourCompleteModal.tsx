"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles } from "lucide-react";
import { LIVE_DEMOS } from "./tour-steps";
import { saveTourState, clearTourState } from "./TourRunner";

const DEMO_KEY = "cf_live_demo";

export function saveDemoState(demoId: string) {
  try { localStorage.setItem(DEMO_KEY, demoId); } catch {}
}
export function getDemoState() {
  try { return localStorage.getItem(DEMO_KEY); } catch { return null; }
}
export function clearDemoState() {
  try { localStorage.removeItem(DEMO_KEY); } catch {}
}

// ─── Demo Runner ──────────────────────────────────────────────────────────────
// Runs the live demo tour on the relevant page via localStorage

export function startLiveDemo(demoId: string, router: ReturnType<typeof useRouter>) {
  clearTourState();
  saveDemoState(demoId);
  const demo = LIVE_DEMOS.find((d) => d.id === demoId);
  if (demo) {
    window.dispatchEvent(new CustomEvent("cf:start-demo", { detail: { demoId } }));
    router.push(demo.page);
  }
}

// ─── Demo Tour Runner (mounted globally) ─────────────────────────────────────

export function DemoRunner() {
  const router = useRouter();

  useEffect(() => {
    const run = (demoId: string) => {
      const demo = LIVE_DEMOS.find((d) => d.id === demoId);
      if (!demo) return;
      clearDemoState();

      setTimeout(() => {
        import("driver.js").then(async ({ driver }) => {
          await import("driver.js/dist/driver.css");

          const d = driver({
            showProgress: true,
            animate: true,
            overlayOpacity: 0.55,
            smoothScroll: true,
            allowClose: true,
            nextBtnText: "Got it, next →",
            prevBtnText: "← Back",
            doneBtnText: "Let's go! 🚀",
            onDestroyStarted: () => { d.destroy(); },
            steps: demo.steps.map((step) => ({
              element: step.element,
              popover: {
                title: step.title,
                description: step.description,
                side: step.side ?? "bottom",
                align: "start",
              },
            })),
          });

          d.drive();
        }).catch(() => clearDemoState());
      }, 900);
    };

    // Handle event fired when already on the target page
    const handleEvent = (e: Event) => {
      const demoId = (e as CustomEvent).detail?.demoId;
      if (demoId) run(demoId);
    };
    window.addEventListener("cf:start-demo", handleEvent);

    // Handle case where we navigated to the page (check localStorage)
    const pending = getDemoState();
    if (pending) run(pending);

    return () => window.removeEventListener("cf:start-demo", handleEvent);
  }, [router]);

  return null;
}

// ─── TourCompleteModal ────────────────────────────────────────────────────────

export function TourCompleteModal() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("cf:tour-complete", handler);
    return () => window.removeEventListener("cf:tour-complete", handler);
  }, []);

  const handleDemo = (demoId: string) => {
    setOpen(false);
    setTimeout(() => startLiveDemo(demoId, router), 200);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[80] backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[90] flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="bg-white dark:bg-[#111] rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-white/10 pointer-events-auto overflow-hidden">

              {/* Header gradient */}
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 px-6 py-6 text-white relative">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                >
                  <X size={16} />
                </button>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-lg leading-tight">Tour Complete! 🎉</p>
                    <p className="text-orange-100 text-xs">You&apos;ve seen everything Content Flywheel can do</p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="px-6 py-5">
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                  Want to see it actually work?
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
                  Pick a live demo and I&apos;ll walk you through the real process — step by step, showing you exactly what to click to create your first video.
                </p>

                <div className="space-y-2.5">
                  {LIVE_DEMOS.map((demo) => (
                    <button
                      key={demo.id}
                      type="button"
                      onClick={() => handleDemo(demo.id)}
                      className="w-full flex items-start gap-3.5 p-3.5 rounded-xl border border-gray-200 dark:border-white/10 hover:border-orange-400 dark:hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-all group text-left"
                    >
                      <span className="text-2xl flex-shrink-0">{demo.emoji}</span>
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                          {demo.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{demo.subtitle}</p>
                      </div>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-full mt-4 py-2.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                  No thanks, I&apos;ll explore on my own
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
