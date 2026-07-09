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
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-center text-sm text-muted-foreground">
        This dashboard page could not load. This is often due to a temporary server or database issue.
      </p>
      {process.env.NODE_ENV !== "production" && error?.message && (
        <p className="text-center text-xs font-mono text-red-500 max-w-lg break-all">{error.message}</p>
      )}
      {error?.message && (
        <p className="text-center text-xs font-mono text-red-400 max-w-lg break-all bg-red-50 dark:bg-red-950/20 p-2 rounded border border-red-200">
          {error.message}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2">
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
