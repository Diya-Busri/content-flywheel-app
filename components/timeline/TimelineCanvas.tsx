"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { TimelineRuler } from "./TimelineRuler";
import { TimelineTrack } from "./TimelineTrack";
import { Playhead } from "./Playhead";
import { useTimeline } from "./TimelineProvider";
import type { TimelineItemType, TrackType } from "./types";
import { LABEL_WIDTH_PX, ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } from "./types";
import { getSnapPositionsPx } from "./utils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DEFAULT_DEMO_ITEMS: TimelineItemType[] = [
  { id: "scene-1", start: 0, end: 5, trackType: "scene" },
  { id: "scene-2", start: 5, end: 10, trackType: "scene" },
  { id: "scene-3", start: 10, end: 15, trackType: "scene" },
  { id: "caption-1", start: 0, end: 2, trackType: "caption" },
  { id: "caption-2", start: 2, end: 4, trackType: "caption" },
  { id: "caption-3", start: 4, end: 6, trackType: "caption" },
  { id: "caption-4", start: 6, end: 8, trackType: "caption" },
  { id: "caption-5", start: 8, end: 10, trackType: "caption" },
  { id: "caption-6", start: 10, end: 12, trackType: "caption" },
  { id: "caption-7", start: 12, end: 14, trackType: "caption" },
  { id: "caption-8", start: 14, end: 15, trackType: "caption" },
];

const SNAP_NEAR_PX = 15;
const AUTO_SCROLL_MARGIN_PX = 48;
const AUTO_SCROLL_SPEED = 12;

interface DragState {
  itemId: string;
  trackType: TrackType;
  clientX: number;
  contentX: number;
}

interface TimelineCanvasProps {
  className?: string;
  initialItems?: TimelineItemType[];
}

export function TimelineCanvas({
  className,
  initialItems = DEFAULT_DEMO_ITEMS,
}: TimelineCanvasProps) {
  const {
    duration,
    setCurrentTime,
    pixelsPerSecond,
    setPixelsPerSecond,
  } = useTimeline();
  const [items, setItems] = useState<TimelineItemType[]>(initialItems);

  // Sync from parent when initialItems change (e.g. voiceover imported) so the timeline clip appears
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const [dragState, setDragState] = useState<DragState | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollDirectionRef = useRef<number>(0);
  const trackAreaRef = useRef<HTMLDivElement>(null);

  const handleItemUpdate = useCallback(
    (id: string, start: number, end: number) => {
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, start, end } : it))
      );
    },
    []
  );

  const handleItemDelete = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const handleDragStart = useCallback((id: string, trackType: TrackType) => {
    setDragState({ itemId: id, trackType, clientX: 0, contentX: 0 });
  }, []);

  const handleDragMove = useCallback((clientX: number) => {
    const el = scrollContainerRef.current;
    setDragState((prev) => {
      if (!prev) return null;
      if (!el) return prev;
      const rect = el.getBoundingClientRect();
      const contentX =
        el.scrollLeft + (clientX - rect.left) - LABEL_WIDTH_PX;
      return { ...prev, clientX, contentX };
    });
    scrollDirectionRef.current = 0;
    if (el) {
      const rect = el.getBoundingClientRect();
      if (clientX - rect.left < AUTO_SCROLL_MARGIN_PX) {
        scrollDirectionRef.current = -1;
      } else if (rect.right - clientX < AUTO_SCROLL_MARGIN_PX) {
        scrollDirectionRef.current = 1;
      }
    }
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragState(null);
    scrollDirectionRef.current = 0;
  }, []);

  useEffect(() => {
    if (!dragState) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    let rafId: number;
    const tick = () => {
      const dir = scrollDirectionRef.current;
      if (dir !== 0) {
        el.scrollLeft += dir * AUTO_SCROLL_SPEED;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [dragState]);

  const snapLinePositionsByTrack = useMemo(() => {
    if (!dragState) return { scene: [], voiceover: [], caption: [] };
    const trackItems = items.filter((i) => i.trackType === dragState.trackType);
    const others = trackItems
      .filter((i) => i.id !== dragState.itemId)
      .map(({ start, end }) => ({ start, end }));
    const positions = getSnapPositionsPx(
      pixelsPerSecond,
      duration,
      others,
      SNAP_NEAR_PX,
      dragState.contentX
    );
    return {
      scene: dragState.trackType === "scene" ? positions : [],
      voiceover: dragState.trackType === "voiceover" ? positions : [],
      caption: dragState.trackType === "caption" ? positions : [],
    };
  }, [dragState, items, pixelsPerSecond, duration]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = trackAreaRef.current;
      if (!el) return;
      const scrollEl = scrollContainerRef.current;
      if (!scrollEl) return;
      const rect = scrollEl.getBoundingClientRect();
      const scrollLeft = scrollEl.scrollLeft;
      const x = e.clientX - rect.left + scrollLeft;
      const contentX = x - LABEL_WIDTH_PX;
      if (contentX < 0) return;
      const time = Math.max(
        0,
        Math.min(duration, contentX / pixelsPerSecond)
      );
      setCurrentTime(Math.round(time * 10) / 10);
    },
    [duration, setCurrentTime, pixelsPerSecond]
  );

  const widthPx = duration * pixelsPerSecond;
  const totalWidth = widthPx + 112;

  const zoomIn = useCallback(() => {
    setPixelsPerSecond((p) => Math.min(ZOOM_MAX, p + ZOOM_STEP));
  }, [setPixelsPerSecond]);

  const zoomOut = useCallback(() => {
    setPixelsPerSecond((p) => Math.max(ZOOM_MIN, p - ZOOM_STEP));
  }, [setPixelsPerSecond]);

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-border bg-background",
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={zoomOut}
            disabled={pixelsPerSecond <= ZOOM_MIN}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={zoomIn}
            disabled={pixelsPerSecond >= ZOOM_MAX}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <span className="ml-2 text-xs text-muted-foreground">
            {pixelsPerSecond}px/s
          </span>
        </div>
      </div>
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto overflow-y-hidden"
      >
        <div
          className="relative min-w-0"
          style={{ width: totalWidth }}
        >
          <div className="flex">
            <div className="sticky left-0 z-10 w-28 shrink-0 border-r border-border bg-muted/50" />
            <TimelineRuler className="flex-1" />
          </div>
          <div
            ref={trackAreaRef}
            className="relative cursor-pointer"
            style={{ width: totalWidth }}
            onClick={handleCanvasClick}
          >
            <div className="flex" style={{ width: totalWidth }}>
              <TimelineTrack
                trackType="scene"
                items={items}
                snapLinePositions={snapLinePositionsByTrack.scene}
                onItemUpdate={handleItemUpdate}
                onItemDelete={handleItemDelete}
                onDragStart={handleDragStart}
                onDragMove={handleDragMove}
                onDragEnd={handleDragEnd}
              />
            </div>
            <div className="flex" style={{ width: totalWidth }}>
              <TimelineTrack
                trackType="voiceover"
                items={items}
                snapLinePositions={snapLinePositionsByTrack.voiceover}
                onItemUpdate={handleItemUpdate}
                onItemDelete={handleItemDelete}
                onDragStart={handleDragStart}
                onDragMove={handleDragMove}
                onDragEnd={handleDragEnd}
              />
            </div>
            <div className="flex" style={{ width: totalWidth }}>
              <TimelineTrack
                trackType="caption"
                items={items}
                snapLinePositions={snapLinePositionsByTrack.caption}
                onItemUpdate={handleItemUpdate}
                onItemDelete={handleItemDelete}
                onDragStart={handleDragStart}
                onDragMove={handleDragMove}
                onDragEnd={handleDragEnd}
              />
            </div>
            <Playhead />
          </div>
        </div>
      </div>
    </div>
  );
}
