"use client";

import React, { memo, useCallback } from "react";
import { Rnd } from "react-rnd";
import { Trash2 } from "lucide-react";
import type { TimelineItemType } from "./types";
import { getSnapPx } from "./types";
import {
  snapToIncrement,
  pxToSeconds,
  clampStartToNoOverlap,
  getResizeBounds,
} from "./utils";
import { cn } from "@/lib/utils";

const TRACK_TYPE_STYLES: Record<
  TimelineItemType["trackType"],
  string
> = {
  scene: "bg-blue-500/90 hover:bg-blue-500 border-blue-400/50",
  voiceover: "bg-purple-500/90 hover:bg-purple-500 border-purple-400/50",
  caption: "bg-emerald-500/90 hover:bg-emerald-500 border-emerald-400/50",
};

interface TimelineItemProps {
  item: TimelineItemType;
  duration: number;
  pixelsPerSecond: number;
  otherItemsInTrack: Array<{ start: number; end: number }>;
  isLocked: boolean;
  onUpdate: (id: string, start: number, end: number) => void;
  onDelete: (id: string) => void;
  onDragStart?: (id: string) => void;
  onDragMove?: (clientX: number) => void;
  onDragEnd?: () => void;
}

export const TimelineItem = memo(function TimelineItem({
  item,
  duration,
  pixelsPerSecond,
  otherItemsInTrack,
  isLocked,
  onUpdate,
  onDelete,
  onDragStart,
  onDragMove,
  onDragEnd,
}: TimelineItemProps) {
  const snapPx = getSnapPx(pixelsPerSecond);
  const left = item.start * pixelsPerSecond;
  const width = (item.end - item.start) * pixelsPerSecond;
  const length = item.end - item.start;
  const maxWidth = duration * pixelsPerSecond;

  const handleDragStop = useCallback(
    (_e: unknown, d: { x: number }) => {
      onDragEnd?.();
      const rawStartSec = pxToSeconds(snapToIncrement(d.x, snapPx), pixelsPerSecond);
      const newStart = clampStartToNoOverlap(
        rawStartSec,
        length,
        otherItemsInTrack,
        duration
      );
      const newEnd = Math.min(newStart + length, duration);
      onUpdate(item.id, newStart, newEnd);
    },
    [
      item.id,
      length,
      otherItemsInTrack,
      duration,
      pixelsPerSecond,
      snapPx,
      onUpdate,
      onDragEnd,
    ]
  );

  const handleResizeStop = useCallback(
    (
      _e: unknown,
      _dir: unknown,
      ref: HTMLElement,
      _delta: { width: number; height: number },
      pos: { x: number }
    ) => {
      onDragEnd?.();
      const { minStart, maxEnd } = getResizeBounds(
        item.start,
        item.end,
        otherItemsInTrack,
        duration
      );
      const newStartSec = pxToSeconds(snapToIncrement(pos.x, snapPx), pixelsPerSecond);
      const newWidthPx = ref.offsetWidth;
      const newEndSec = pxToSeconds(
        snapToIncrement(pos.x + newWidthPx, snapPx),
        pixelsPerSecond
      );
      const newStart = Math.max(
        minStart,
        Math.min(newStartSec, maxEnd - 0.1)
      );
      const newEnd = Math.max(
        newStart + 0.1,
        Math.min(newEndSec, maxEnd)
      );
      onUpdate(item.id, newStart, newEnd);
    },
    [item.id, item.start, item.end, otherItemsInTrack, duration, pixelsPerSecond, snapPx, onUpdate, onDragEnd]
  );

  const handleDragStart = useCallback(() => {
    onDragStart?.(item.id);
  }, [item.id, onDragStart]);

  const handleDrag = useCallback(
    (e: MouseEvent | TouchEvent, _d: { x: number; y: number }) => {
      const clientX =
        "clientX" in e ? e.clientX : e.touches[0]?.clientX ?? 0;
      onDragMove?.(clientX);
    },
    [onDragMove]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete(item.id);
    },
    [item.id, onDelete]
  );

  return (
    <Rnd
      position={{ x: left, y: 0 }}
      size={{ width, height: "100%" }}
      minWidth={pixelsPerSecond * 0.2}
      maxWidth={maxWidth - left}
      dragAxis="x"
      disableDragging={isLocked}
      enableResizing={isLocked ? false : { left: true, right: true, top: false, bottom: false }}
      bounds="parent"
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      dragGrid={[snapPx, 0]}
      resizeGrid={[snapPx, 0]}
      className={cn(
        "rounded-md border shadow-sm transition-colors group",
        TRACK_TYPE_STYLES[item.trackType]
      )}
    >
      <div className="flex h-full w-full items-center gap-1 px-2 pr-8 text-xs font-medium text-white/90">
        <span className="truncate">
          {item.trackType === "scene" && `Scene ${item.id}`}
          {item.trackType === "voiceover" && "Voiceover"}
          {item.trackType === "caption" && `Caption ${item.id}`}
        </span>
        {!isLocked && (
          <button
            type="button"
            onClick={handleDelete}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 opacity-0 transition-opacity hover:bg-white/20 group-hover:opacity-100"
            aria-label="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </Rnd>
  );
});
