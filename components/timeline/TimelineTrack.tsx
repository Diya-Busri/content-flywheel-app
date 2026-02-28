"use client";

import React, { memo, useCallback } from "react";
import { Lock, Unlock } from "lucide-react";
import type { TrackType, TimelineItemType } from "./types";
import { TimelineItem } from "./TimelineItem";
import { SnappingLines } from "./SnappingLines";
import { useTimeline } from "./TimelineProvider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TRACK_LABELS: Record<TrackType, string> = {
  scene: "Scenes",
  voiceover: "Voiceover",
  caption: "Captions",
};

interface TimelineTrackProps {
  trackType: TrackType;
  items: TimelineItemType[];
  snapLinePositions?: number[];
  onItemUpdate: (id: string, start: number, end: number) => void;
  onItemDelete: (id: string) => void;
  onDragStart: (id: string, trackType: TrackType) => void;
  onDragMove: (clientX: number) => void;
  onDragEnd: () => void;
  className?: string;
}

export const TimelineTrack = memo(function TimelineTrack({
  trackType,
  items,
  snapLinePositions = [],
  onItemUpdate,
  onItemDelete,
  onDragStart,
  onDragMove,
  onDragEnd,
  className,
}: TimelineTrackProps) {
  const { duration, pixelsPerSecond, lockedTracks, toggleTrackLock } =
    useTimeline();
  const isLocked = lockedTracks.has(trackType);

  const filteredItems = items.filter((i) => i.trackType === trackType);
  const otherItemsFor = useCallback(
    (itemId: string) =>
      filteredItems
        .filter((i) => i.id !== itemId)
        .map(({ start, end }) => ({ start, end })),
    [filteredItems]
  );

  const handleDragStart = useCallback(
    (id: string) => onDragStart(id, trackType),
    [trackType, onDragStart]
  );

  return (
    <div
      className={cn(
        "relative flex h-20 shrink-0 items-stretch border-b border-border bg-muted/30",
        className
      )}
    >
      <div className="sticky left-0 z-10 flex w-28 shrink-0 items-center justify-between gap-1 border-r border-border bg-muted/50 px-2 text-sm font-medium text-muted-foreground">
        <span>{TRACK_LABELS[trackType]}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => toggleTrackLock(trackType)}
          aria-label={isLocked ? "Unlock track" : "Lock track"}
          type="button"
        >
          {isLocked ? (
            <Lock className="h-3.5 w-3.5" />
          ) : (
            <Unlock className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <SnappingLines positionsPx={snapLinePositions} />
        {filteredItems.map((item) => (
          <TimelineItem
            key={item.id}
            item={item}
            duration={duration}
            pixelsPerSecond={pixelsPerSecond}
            otherItemsInTrack={otherItemsFor(item.id)}
            isLocked={isLocked}
            onUpdate={onItemUpdate}
            onDelete={onItemDelete}
            onDragStart={handleDragStart}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
          />
        ))}
      </div>
    </div>
  );
});
