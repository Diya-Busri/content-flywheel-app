"use client";

import React, { memo } from "react";
import { cn } from "@/lib/utils";

interface SnappingLinesProps {
  positionsPx: number[];
  className?: string;
}

export const SnappingLines = memo(function SnappingLines({
  positionsPx,
  className,
}: SnappingLinesProps) {
  if (positionsPx.length === 0) return null;

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 z-0", className)}
      aria-hidden
    >
      {positionsPx.map((left) => (
        <div
          key={left}
          className="absolute top-0 h-full w-px bg-primary/50"
          style={{ left }}
        />
      ))}
    </div>
  );
});
