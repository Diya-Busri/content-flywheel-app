"use client";

import React, { memo } from "react";
import { useTimeline } from "./TimelineProvider";
import { cn } from "@/lib/utils";

export const TimelineRuler = memo(function TimelineRuler({
  className,
}: {
  className?: string;
}) {
  const { duration, pixelsPerSecond } = useTimeline();
  const markers = Array.from(
    { length: Math.ceil(duration) + 1 },
    (_, i) => i
  );

  return (
    <div
      className={cn(
        "sticky top-0 z-10 flex h-10 shrink-0 items-end border-b border-border bg-muted/80 backdrop-blur-sm",
        className
      )}
      style={{ width: duration * pixelsPerSecond }}
    >
      {markers.map((sec) => (
        <div
          key={sec}
          className="absolute flex flex-col items-start border-l border-border/80 pl-1 text-xs text-muted-foreground"
          style={{ left: sec * pixelsPerSecond }}
        >
          <span className="font-medium">{sec}s</span>
        </div>
      ))}
    </div>
  );
});
