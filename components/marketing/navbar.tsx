"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

const ACCENT = "#F5C97A";
const NAV_LINKS = [
  { href: "#product", label: "Product" },
  { href: "#how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
] as const;

export function Navbar() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.header
      className="sticky top-0 z-50 border-b border-white/10 bg-[#0B0B0F]/90 shadow-[0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-xl"
      initial={reduceMotion ? false : { y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={
        reduceMotion ? { duration: 0 } : { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }
      }
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-white transition-opacity hover:opacity-90"
        >
          Content <span style={{ color: ACCENT }}>Flywheel</span>
        </Link>

        <div className="hidden items-center gap-10 lg:flex">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-sm text-white/70 transition-colors hover:text-white"
            >
              {label}
            </Link>
          ))}
        </div>

        <Link
          href="#waitlist"
          className="inline-flex items-center justify-center rounded-lg bg-[#F5C97A] px-4 py-2.5 text-sm font-semibold text-[#0B0B0F] transition-colors hover:bg-[#F7D79A]"
        >
          Join waitlist
        </Link>
      </nav>
    </motion.header>
  );
}
