"use client";

/**
 * PageHeader — shared layout component
 * ──────────────────────────────────────────────────────────────────────────────
 * Provides consistent page chrome across every dashboard page:
 *   - Breadcrumb trail with separator
 *   - Large page title
 *   - Optional subtitle
 *   - Optional right-side action slot
 *   - Optional bottom border / sticky behaviour
 *
 * Usage:
 *   <PageHeader
 *     breadcrumbs={[{ label: "Projects", href: "/dashboard/projects" }]}
 *     title="My Project"
 *     subtitle="AI company · 3 departments running"
 *     action={<Button>Run cycle</Button>}
 *   />
 */

import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type Breadcrumb = {
  label: string;
  href?: string;
};

type Props = {
  breadcrumbs?: Breadcrumb[];
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  /** Adds a bottom border — use on pages with sticky headers */
  border?: boolean;
  /** px padding — defaults to "px-4 sm:px-6 md:px-8" */
  className?: string;
};

export function PageHeader({
  breadcrumbs,
  title,
  subtitle,
  action,
  border = false,
  className = "",
}: Props) {
  return (
    <div
      className={`
        py-4 px-4 sm:px-6 md:px-8
        bg-[#F9FAFB] dark:bg-[#0F0F0F]
        ${border ? "border-b border-[#E5E7EB] dark:border-[#1E1E1E]" : ""}
        ${className}
      `}
    >
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="breadcrumb" className="flex items-center gap-1 mb-2 flex-wrap">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors font-medium"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  {crumb.label}
                </span>
              )}
              {i < breadcrumbs.length - 1 && (
                <ChevronRight className="h-3 w-3 text-gray-300 dark:text-gray-600 shrink-0" />
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Title row */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white leading-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 leading-snug">
              {subtitle}
            </p>
          )}
        </div>
        {action && (
          <div className="shrink-0 flex items-center gap-2 mt-0.5">
            {action}
          </div>
        )}
      </div>
    </div>
  );
}
