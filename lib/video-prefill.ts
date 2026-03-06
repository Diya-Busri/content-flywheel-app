/**
 * Smart linking: prefill data when creating a video from planning pages.
 * Stored in sessionStorage so Video Timeline can pre-populate script, thumbnail, title/description, hashtags, scheduled date.
 */

const STORAGE_KEY = "content-flywheel-video-prefill";

export type TimelineScenePrefill = {
  scene_number?: number;
  duration_seconds?: number;
  visual?: string;
  text_overlay?: string;
  overlay_timing?: string;
  voiceover_line?: string;
};

export type VideoPrefill = {
  scriptId?: string;
  thumbnailUrl?: string;
  title?: string;
  description?: string;
  hashtags?: string;
  scheduledAt?: string; // ISO date or datetime
  /** Optional: hint from which tool (for analytics or UI) */
  source?: "video-ideas" | "script-checker" | "thumbnails" | "copy-writer" | "seo" | "calendar" | "campaign-mode";
  /** From Campaign Mode: voiceover text for TTS / timeline */
  voiceoverText?: string;
  /** From Campaign Mode: scenes to pre-fill timeline */
  timelineScenes?: TimelineScenePrefill[];
};

export function getVideoPrefill(): VideoPrefill | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const p = parsed as Record<string, unknown>;
    const timelineScenes = Array.isArray(p.timelineScenes) ? (p.timelineScenes as unknown[]).map((s) => {
      const o = s && typeof s === "object" ? (s as Record<string, unknown>) : {};
      return {
        scene_number: typeof o.scene_number === "number" ? o.scene_number : undefined,
        duration_seconds: typeof o.duration_seconds === "number" ? o.duration_seconds : undefined,
        visual: typeof o.visual === "string" ? o.visual : undefined,
        text_overlay: typeof o.text_overlay === "string" ? o.text_overlay : undefined,
        overlay_timing: typeof o.overlay_timing === "string" ? o.overlay_timing : undefined,
        voiceover_line: typeof o.voiceover_line === "string" ? o.voiceover_line : undefined,
      };
    }) : undefined;
    return {
      scriptId: typeof p.scriptId === "string" ? p.scriptId : undefined,
      thumbnailUrl: typeof p.thumbnailUrl === "string" ? p.thumbnailUrl : undefined,
      title: typeof p.title === "string" ? p.title : undefined,
      description: typeof p.description === "string" ? p.description : undefined,
      hashtags: typeof p.hashtags === "string" ? p.hashtags : undefined,
      scheduledAt: typeof p.scheduledAt === "string" ? p.scheduledAt : undefined,
      source: typeof p.source === "string" ? p.source as VideoPrefill["source"] : undefined,
      voiceoverText: typeof p.voiceoverText === "string" ? p.voiceoverText : undefined,
      timelineScenes,
    };
  } catch {
    return null;
  }
}

export function setVideoPrefill(prefill: VideoPrefill): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(prefill));
  } catch {
    // ignore
  }
}

export function clearVideoPrefill(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Build timeline URL with optional scriptId; prefill should already be set. */
export function getTimelineUrl(scriptId?: string): string {
  const base = "/dashboard/video-timeline";
  if (scriptId) return `${base}?scriptId=${encodeURIComponent(scriptId)}`;
  return base;
}
