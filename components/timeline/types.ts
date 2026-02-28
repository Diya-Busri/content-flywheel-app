export type TrackType = "scene" | "voiceover" | "caption";

export interface TimelineItemType {
  id: string;
  start: number;
  end: number;
  trackType: TrackType;
  /** For voiceover/audio clips: "audio" */
  type?: "audio";
  /** For voiceover/audio clips: audio URL (width = (end - start) * pixelsPerSecond) */
  src?: string;
}

export const DEFAULT_PIXELS_PER_SECOND = 100;
export const ZOOM_MIN = 50;
export const ZOOM_MAX = 300;
export const ZOOM_STEP = 25;
export const SNAP_INCREMENT = 0.1;
export const LABEL_WIDTH_PX = 112;

export function getSnapPx(pixelsPerSecond: number): number {
  return pixelsPerSecond * SNAP_INCREMENT;
}
