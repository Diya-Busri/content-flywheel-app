"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X, ChevronDown, ChevronRight, ExternalLink, HelpCircle, PlayCircle, BookOpen, Lightbulb, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PAGE_TOURS, ALL_FEATURES, type TourStep } from "./tour-steps";
import { startFullAppTour, clearTourState, getTourState } from "./TourRunner";
import { markOnboardingDone, resetOnboarding } from "./OnboardingTrigger";

// ─── Tour Engine ──────────────────────────────────────────────────────────────

function runTour(steps: TourStep[], onDone: () => void) {
  // Dynamically import driver.js to avoid SSR issues
  import("driver.js").then(({ driver }) => {
    import("driver.js/dist/driver.css");
    const d = driver({
      showProgress: true,
      animate: true,
      overlayOpacity: 0.55,
      smoothScroll: true,
      allowClose: true,
      nextBtnText: "Next →",
      prevBtnText: "← Back",
      doneBtnText: "Done ✓",
      onDestroyStarted: () => {
        d.destroy();
        onDone();
      },
      steps: steps.map((s) => ({
        element: s.element,
        popover: {
          title: s.title,
          description: s.description,
          side: s.side ?? "bottom",
          align: "start",
        },
      })),
    });
    d.drive();
  }).catch(() => {
    // driver.js not available — show a simple alert fallback
    steps.forEach((s, i) => {
      if (i === 0) alert(`${s.title}\n\n${s.description}`);
    });
    onDone();
  });
}

// ─── Feature Card ─────────────────────────────────────────────────────────────

function FeatureCard({ feature, onNavigate }: {
  feature: typeof ALL_FEATURES[number];
  onNavigate: (href: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left"
      >
        <span className="text-xl flex-shrink-0">{feature.emoji}</span>
        <span className="font-semibold text-sm text-gray-900 dark:text-white flex-1">{feature.title}</span>
        {open ? <ChevronDown size={15} className="text-gray-400" /> : <ChevronRight size={15} className="text-gray-400" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-gray-100 dark:border-white/10 pt-3">
              <p className="text-sm text-gray-600 dark:text-gray-300">{feature.description}</p>

              {feature.tips.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Lightbulb size={11} /> Tips
                  </p>
                  <ul className="space-y-1">
                    {feature.tips.map((tip, i) => (
                      <li key={i} className="text-xs text-gray-500 dark:text-gray-400 flex gap-2">
                        <span className="text-orange-400 flex-shrink-0">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                type="button"
                onClick={() => onNavigate(feature.href)}
                className="flex items-center gap-1.5 text-xs font-semibold text-orange-500 hover:text-orange-600 transition-colors"
              >
                <ExternalLink size={12} /> Go there
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

type Tab = "guide" | "tour";

export function HelpPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("guide");
  const [tourRunning, setTourRunning] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Find tour for current page
  const currentTour = PAGE_TOURS.find((t) =>
    pathname === t.page || (t.page !== "/dashboard" && pathname.startsWith(t.page))
  );

  const handleStartTour = useCallback(() => {
    if (!currentTour) return;
    onClose();
    setTourRunning(true);
    setTimeout(() => {
      runTour(currentTour.steps, () => setTourRunning(false));
    }, 350); // wait for panel to close
  }, [currentTour, onClose]);

  const handleNavigate = useCallback((href: string) => {
    onClose();
    router.push(href);
  }, [onClose, router]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-[60] backdrop-blur-sm"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Slide-over panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed right-0 top-0 h-full w-full max-w-sm bg-white dark:bg-[#111] z-[70] flex flex-col shadow-2xl border-l border-gray-200 dark:border-white/10"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <HelpCircle size={18} className="text-orange-500" />
                <span className="font-bold text-gray-900 dark:text-white text-base">Help Centre</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 dark:border-white/10 flex-shrink-0">
              {([
                { id: "guide" as Tab, label: "Feature Guide", icon: <BookOpen size={14} /> },
                { id: "tour" as Tab, label: "Page Tour", icon: <PlayCircle size={14} /> },
              ] as const).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors border-b-2 ${
                    tab === t.id
                      ? "border-orange-500 text-orange-600 dark:text-orange-400"
                      : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  }`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">

              {/* ── Full App Tour banner ── */}
              <div className="mx-4 mt-4 mb-1 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 p-4 text-white shadow-md">
                <div className="flex items-center gap-2 mb-1.5">
                  <Zap size={16} className="flex-shrink-0" />
                  <span className="font-bold text-sm">Full App Demo Tour</span>
                </div>
                <p className="text-xs text-orange-100 mb-3 leading-relaxed">
                  Visits every feature page automatically — highlights real buttons and explains exactly what to click. Takes about 3 minutes.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      clearTourState();
                      markOnboardingDone();
                      onClose();
                      setTimeout(() => startFullAppTour(router), 200);
                    }}
                    className="flex-1 py-2 rounded-lg bg-white text-orange-600 text-sm font-bold hover:bg-orange-50 transition-colors"
                  >
                    🚀 Start Tour
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearTourState();
                      resetOnboarding();
                      onClose();
                      setTimeout(() => startFullAppTour(router), 200);
                    }}
                    className="py-2 px-3 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-colors"
                    title="Restart tour from the beginning"
                  >
                    ↺ Replay
                  </button>
                </div>
              </div>

              {/* ── Feature Guide tab ── */}
              {tab === "guide" && (
                <div className="p-4 space-y-2.5">
                  <p className="text-xs text-gray-400 dark:text-gray-500 pb-1">
                    Tap any feature to learn what it does and how to use it.
                  </p>
                  {ALL_FEATURES.map((f) => (
                    <FeatureCard key={f.href} feature={f} onNavigate={handleNavigate} />
                  ))}
                </div>
              )}

              {/* ── Page Tour tab ── */}
              {tab === "tour" && (
                <div className="p-5 space-y-5">
                  {currentTour ? (
                    <>
                      <div className="rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-900/40 p-4 space-y-2">
                        <p className="font-semibold text-orange-700 dark:text-orange-300 text-sm">
                          Ready to tour: {currentTour.label}
                        </p>
                        <p className="text-xs text-orange-600 dark:text-orange-400">
                          {currentTour.steps.length} stops — highlights real elements on this page and explains each one.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleStartTour}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-colors shadow-sm"
                      >
                        <PlayCircle size={17} />
                        Start tour of this page
                      </button>

                      {/* Step preview */}
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">What you&apos;ll see</p>
                        {currentTour.steps.map((step, i) => (
                          <div key={i} className="flex gap-3 p-3 rounded-lg bg-gray-50 dark:bg-white/5">
                            <span className="w-5 h-5 rounded-full bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <div>
                              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{step.title}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{step.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 p-4 text-center space-y-2">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">No tour for this page yet</p>
                        <p className="text-xs text-gray-400">Navigate to a main feature page and come back to start its tour.</p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Available tours</p>
                        {PAGE_TOURS.map((pt) => (
                          <button
                            key={pt.page}
                            type="button"
                            onClick={() => handleNavigate(pt.page)}
                            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-white/5 hover:bg-orange-50 dark:hover:bg-orange-950/20 border border-gray-200 dark:border-white/10 text-left transition-colors group"
                          >
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-200 group-hover:text-orange-600 dark:group-hover:text-orange-400">{pt.label}</span>
                            <span className="text-xs text-gray-400">{pt.steps.length} steps →</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-100 dark:border-white/10 flex-shrink-0">
              <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center">
                Press <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-white/10 rounded text-[10px] font-mono">Esc</kbd> to close
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Floating trigger button (used in sidebar) ────────────────────────────────

export function HelpButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-center md:justify-start gap-1.5 py-2 px-3 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white transition-colors"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      aria-label="Open Help"
    >
      <HelpCircle size={18} />
      <span className="text-sm font-medium hidden md:block">Help</span>
    </motion.button>
  );
}
