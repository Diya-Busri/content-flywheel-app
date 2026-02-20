"use client";

import { useState, useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Package, Megaphone, BarChart3 } from "lucide-react";

const HAS_SEEN_WELCOME_KEY = "hasSeenWelcome";

function fireConfetti() {
  try {
    const count = 200;
    const defaults = { origin: { y: 0.6 }, zIndex: 9999 };
    confetti({ ...defaults, particleCount: count, spread: 100 });
    confetti({ ...defaults, particleCount: count * 0.6, angle: 60, spread: 80 });
    confetti({ ...defaults, particleCount: count * 0.6, angle: 120, spread: 80 });
  } catch {
    // ignore
  }
}

const FEATURES = [
  {
    icon: Package,
    title: "Create digital products",
    description: "Generate ebooks, planners, workbooks, and more with AI—then customize and export to PDF.",
  },
  {
    icon: Megaphone,
    title: "Sell & promote",
    description: "Get sales copy, hooks, and marketing assets tailored to your niche and product.",
  },
  {
    icon: BarChart3,
    title: "Track & grow",
    description: "Organize your products in your library and scale with templates and bundles.",
  },
];

export function WelcomeModal() {
  const [open, setOpen] = useState(false);
  const confettiFired = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = localStorage.getItem(HAS_SEEN_WELCOME_KEY);
    if (!seen) setOpen(true);
  }, []);

  useEffect(() => {
    if (open && !confettiFired.current) {
      const t = setTimeout(() => {
        fireConfetti();
        confettiFired.current = true;
      }, 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  const handleGetStarted = () => {
    try {
      localStorage.setItem(HAS_SEEN_WELCOME_KEY, "1");
    } catch {
      // ignore
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleGetStarted()}>
      <DialogContent className="sm:max-w-md border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl sm:text-2xl">
            <Sparkles className="w-6 h-6 text-orange-500" />
            Welcome to Content Flywheel
          </DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-400 pt-1">
            You&apos;re all set. Here&apos;s how to get the most out of your dashboard.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-4 py-4">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <li key={title} className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{title}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
              </div>
            </li>
          ))}
        </ul>
        <Button
          onClick={handleGetStarted}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold"
        >
          Get Started
        </Button>
      </DialogContent>
    </Dialog>
  );
}
