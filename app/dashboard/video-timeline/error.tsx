"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function VideoTimelineError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Video Timeline error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4">
      <h2 className="text-lg font-semibold">Video Timeline error</h2>
      <p className="text-center text-sm text-muted-foreground">
        The video timeline could not load. Try again or go back to the dashboard.
      </p>
      {/* Temporary debug info — remove once root cause is identified */}
      <div className="max-w-lg w-full bg-red-950/30 border border-red-800/40 rounded p-3 text-left">
        <p className="text-xs font-mono text-red-400 break-all">{error?.message || "No message"}</p>
        {error?.digest && <p className="text-xs font-mono text-red-600 mt-1">digest: {error.digest}</p>}
        {error?.stack && (
          <pre className="text-xs font-mono text-red-500/70 mt-2 overflow-x-auto whitespace-pre-wrap">
            {error.stack.split("\n").slice(0, 6).join("\n")}
          </pre>
        )}
      </div>
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
