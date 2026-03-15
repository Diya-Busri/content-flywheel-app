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
