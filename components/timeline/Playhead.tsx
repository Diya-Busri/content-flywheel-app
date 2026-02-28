"use client";

import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { useTimeline } from "./TimelineProvider";
import { LABEL_WIDTH_PX } from "./types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Playhead = memo(function Playhead({
  className,
}: {
  className?: string;
}) {
  const { currentTime, setCurrentTime, duration, pixelsPerSecond } =
    useTimeline();
  const [isPlaying, setIsPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const startCurrentTimeRef = useRef<number>(0);

  const stopPlayback = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    if (!isPlaying) return;

    startTimeRef.current = performance.now();
    startCurrentTimeRef.current = currentTime;

    const tick = (now: number) => {
      const elapsed = (now - startTimeRef.current) / 1000;
      const next = startCurrentTimeRef.current + elapsed;
      if (next >= duration) {
        setCurrentTime(duration);
        stopPlayback();
        return;
      }
      setCurrentTime(next);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isPlaying, duration, setCurrentTime, stopPlayback]);

  const togglePlay = useCallback(() => {
    if (currentTime >= duration) {
      setCurrentTime(0);
    }
    setIsPlaying((p) => !p);
  }, [currentTime, duration, setCurrentTime]);

  const leftPx = LABEL_WIDTH_PX + currentTime * pixelsPerSecond;

  return (
    <div className={cn("pointer-events-none absolute inset-0 z-20", className)}>
      <div
        className="pointer-events-auto absolute top-0 h-full w-0.5 bg-red-500 shadow-lg shadow-red-500/50"
        style={{ left: leftPx }}
      />
      <div
        className="pointer-events-auto absolute left-0 top-0 z-30 flex items-center gap-1"
        style={{ transform: `translateX(calc(${leftPx}px - 50%))` }}
      >
        <Button
          size="icon"
          variant="destructive"
          className="h-8 w-8 rounded-full"
          onClick={togglePlay}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
});
