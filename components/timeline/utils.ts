import type { TimelineItemType } from "./types";
import { getSnapPx } from "./types";

export function snapToIncrement(value: number, snapPx: number): number {
  return Math.round(value / snapPx) * snapPx;
}

export function pxToSeconds(px: number, pixelsPerSecond: number): number {
  return Math.round((px / pixelsPerSecond) * 10) / 10;
}

export function getGaps(
  others: Array<{ start: number; end: number }>,
  duration: number
): Array<[number, number]> {
  const sorted = [...others].sort((a, b) => a.start - b.start);
  const gaps: Array<[number, number]> = [];
  let pos = 0;
  for (const seg of sorted) {
    if (seg.start > pos) {
      gaps.push([pos, seg.start]);
    }
    pos = Math.max(pos, seg.end);
  }
  if (pos < duration) {
    gaps.push([pos, duration]);
  }
  return gaps;
}

export function clampStartToNoOverlap(
  newStart: number,
  length: number,
  others: Array<{ start: number; end: number }>,
  duration: number
): number {
  const gaps = getGaps(others, duration);
  for (const [gapStart, gapEnd] of gaps) {
    const validStartEnd = gapEnd - length;
    if (validStartEnd < gapStart) continue;
    if (newStart >= gapStart && newStart <= validStartEnd) {
      return newStart;
    }
    if (newStart < gapStart) return gapStart;
    if (newStart > validStartEnd && newStart < gapEnd) return validStartEnd;
  }
  return Math.max(0, Math.min(duration - length, newStart));
}

export function getResizeBounds(
  itemStart: number,
  itemEnd: number,
  othersInTrack: Array<{ start: number; end: number }>,
  duration: number
): { minStart: number; maxEnd: number } {
  const toLeft = othersInTrack.filter((o) => o.end <= itemStart);
  const toRight = othersInTrack.filter((o) => o.start >= itemEnd);
  const minStart = toLeft.length
    ? Math.max(0, Math.max(...toLeft.map((o) => o.end)))
    : 0;
  const maxEnd = toRight.length
    ? Math.min(duration, Math.min(...toRight.map((o) => o.start)))
    : duration;
  return { minStart, maxEnd };
}

export function getSnapPositionsPx(
  pixelsPerSecond: number,
  duration: number,
  otherItemsInTrack: Array<{ start: number; end: number }>,
  nearPx: number,
  currentPx: number
): number[] {
  const snapPx = getSnapPx(pixelsPerSecond);
  const positions: number[] = [];
  const addIfNear = (px: number) => {
    if (Math.abs(px - currentPx) <= nearPx) positions.push(px);
  };
  for (let t = 0; t <= duration; t += 0.1) {
    addIfNear(t * pixelsPerSecond);
  }
  for (const { start, end } of otherItemsInTrack) {
    addIfNear(start * pixelsPerSecond);
    addIfNear(end * pixelsPerSecond);
  }
  return [...new Set(positions)];
}
