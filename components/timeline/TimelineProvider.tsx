"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { TrackType } from "./types";
import { DEFAULT_PIXELS_PER_SECOND } from "./types";

interface TimelineContextValue {
  currentTime: number;
  duration: number;
  setCurrentTime: (t: number | ((prev: number) => number)) => void;
  setDuration: (d: number) => void;
  pixelsPerSecond: number;
  setPixelsPerSecond: (v: number | ((prev: number) => number)) => void;
  lockedTracks: Set<TrackType>;
  toggleTrackLock: (track: TrackType) => void;
}

const TimelineContext = createContext<TimelineContextValue | null>(null);

const DEFAULT_DURATION = 15;

export function TimelineProvider({
  children,
  initialDuration = DEFAULT_DURATION,
}: {
  children: React.ReactNode;
  initialDuration?: number;
}) {
  const [currentTime, setCurrentTimeState] = useState(0);
  const [duration, setDurationState] = useState(initialDuration);
  const [pixelsPerSecond, setPixelsPerSecondState] = useState(
    DEFAULT_PIXELS_PER_SECOND
  );
  const [lockedTracks, setLockedTracksState] = useState<Set<TrackType>>(
    new Set()
  );

  const setCurrentTime = useCallback(
    (t: number | ((prev: number) => number)) => {
      setCurrentTimeState((prev) => {
        const next = typeof t === "function" ? t(prev) : t;
        return Math.max(0, Math.min(next, duration));
      });
    },
    [duration]
  );

  const setDuration = useCallback((d: number) => {
    setDurationState((prev) => Math.max(0.1, d));
  }, []);

  const setPixelsPerSecond = useCallback(
    (v: number | ((prev: number) => number)) => {
      setPixelsPerSecondState((prev) => {
        const next = typeof v === "function" ? v(prev) : v;
        return Math.max(50, Math.min(300, next));
      });
    },
    []
  );

  const toggleTrackLock = useCallback((track: TrackType) => {
    setLockedTracksState((prev) => {
      const next = new Set(prev);
      if (next.has(track)) next.delete(track);
      else next.add(track);
      return next;
    });
  }, []);

  const value = useMemo<TimelineContextValue>(
    () => ({
      currentTime,
      duration,
      setCurrentTime,
      setDuration: setDurationState,
      pixelsPerSecond,
      setPixelsPerSecond,
      lockedTracks,
      toggleTrackLock,
    }),
    [
      currentTime,
      duration,
      setCurrentTime,
      pixelsPerSecond,
      setPixelsPerSecond,
      lockedTracks,
      toggleTrackLock,
    ]
  );

  return (
    <TimelineContext.Provider value={value}>{children}</TimelineContext.Provider>
  );
}

export function useTimeline() {
  const ctx = useContext(TimelineContext);
  if (!ctx) {
    throw new Error("useTimeline must be used within TimelineProvider");
  }
  return ctx;
}
