"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Dashboard error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4">
      <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
        <span className="text-2xl">⚠️</span>
      </div>
      <div className="text-center max-w-sm">
        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">Something went wrong</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          This page couldn{"'"}t load — usually a temporary issue. Try refreshing or go back to the dashboard.
        </p>
      </div>

      {/* Only show technical details in development — never in production */}
      {process.env.NODE_ENV !== "production" && error?.message && (
        <p className="text-center text-xs font-mono text-red-500 max-w-lg break-all bg-red-50 dark:bg-red-950/20 p-2 rounded border border-red-200">
          {error.message}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
        <Button onClick={reset} variant="outline">
          Try again
        </Button>
        <Button asChild variant="default">
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
