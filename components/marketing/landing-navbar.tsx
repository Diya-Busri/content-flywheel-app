"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_OFFSET_PX = 72; // Space below fixed navbar when scrolling to section
const SECTION_IDS = ["features", "how-it-works", "pricing-preview"] as const;

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const top =
    el.getBoundingClientRect().top + window.scrollY - NAV_OFFSET_PX;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

export function LandingNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const handleNavClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    scrollToSection(id);
    setMobileOpen(false);
  }, []);

  // IntersectionObserver to highlight active section
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = entry.target.id;
          if (SECTION_IDS.includes(id as (typeof SECTION_IDS)[number])) {
            setActiveSection(id);
          }
        }
      },
      {
        rootMargin: `-${NAV_OFFSET_PX}px 0px -60% 0px`,
        threshold: 0,
      }
    );
    SECTION_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const navLinks = [
    { label: "Features", id: "features" },
    { label: "How it Works", id: "how-it-works" },
    { label: "Pricing", id: "pricing-preview" },
  ];

  const linkClass = (id: string) =>
    cn(
      "inline-flex items-center justify-center h-10 flex-shrink-0 whitespace-nowrap rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
      activeSection === id
        ? "text-amber-600 dark:text-amber-400"
        : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
    );

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-slate-800 dark:bg-slate-900/95 dark:supports-[backdrop-filter]:dark:bg-slate-900/80">
      <nav className="relative mx-auto flex h-16 max-w-6xl flex-row items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Left: logo */}
        <Link
          href="/"
          className="z-10 shrink-0 text-lg font-semibold tracking-tight text-slate-900 dark:text-white"
        >
          Content <span className="text-amber-500">Flywheel</span>
        </Link>

        {/* Center: nav links (desktop) */}
        <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 flex-row items-center gap-6 md:flex">
          {navLinks.map(({ label, id }) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={(e) => handleNavClick(e, id)}
              className={linkClass(id)}
            >
              {label}
            </a>
          ))}
        </div>

        {/* Right: theme + CTA (desktop) */}
        <div className="hidden shrink-0 flex-row items-center gap-3 md:flex">
          <ThemeToggle />
          <Link
            href="/sign-up"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-amber-400"
          >
            Start Creating Free
          </Link>
        </div>

        {/* Mobile: theme + hamburger */}
        <div className="z-10 flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-600 dark:text-slate-400"
                aria-label="Open menu"
              >
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="flex w-[min(100vw-2rem,320px)] flex-col gap-6 pt-10"
            >
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <div className="flex flex-col gap-1">
                {navLinks.map(({ label, id }) => (
                  <a
                    key={id}
                    href={`#${id}`}
                    onClick={(e) => handleNavClick(e, id)}
                    className={cn(
                      "rounded-lg px-4 py-3 text-base font-medium",
                      linkClass(id)
                    )}
                  >
                    {label}
                  </a>
                ))}
              </div>
              <Link
                href="/sign-up"
                onClick={() => setMobileOpen(false)}
                className="rounded-xl bg-amber-500 px-5 py-3 text-center text-sm font-semibold text-slate-900 hover:bg-amber-400"
              >
                Start Creating Free
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-4 text-slate-600 dark:text-slate-400"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </Button>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
