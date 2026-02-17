"use client";

import { useState, useEffect } from "react";

const TIMEOUT_MS = 15000;

export function DiscoverLoadFailed() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8">
      <p className="text-center text-[#A0A0A0]">Discover failed to load. Please refresh the page.</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
      >
        Refresh page
      </button>
    </div>
  );
}

export function DiscoverLoadingWithTimeout() {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => clearTimeout(t);
  }, []);

  if (timedOut) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8">
        <p className="text-center text-[#A0A0A0]">Taking a while? Try refreshing the page.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
        >
          Refresh page
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="text-center text-[#A0A0A0]">Loading discover...</div>
    </div>
  );
}
