"use client";

import "./timeline-scroll.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getVideoPrefill, clearVideoPrefill, type VideoPrefill } from "@/lib/video-prefill";

/**
 * React 18 Strict Mode double-mounts in dev: the prefill effect clears sessionStorage on the first
 * mount, then the remounted instance reads empty storage and never selects a template. Keep a
 * one-shot backup until the second mount consumes it.
 */
let videoTimelinePrefillStrictModeBackup: VideoPrefill | null = null;
/** Set when template-studio prefill applies; blocks library/saved_script load from replacing those scenes until scriptId changes. */
let skipLibraryTimelineHydrationForScriptId: string | null = null;
import {
  buildViralCaptionDrawtextChain,
  VIRAL_CAPTION_BOTTOM_PAD,
  VIRAL_CAPTION_FONT_SIZES,
} from "@/lib/video-caption-ffmpeg";
import { Loader2, Menu, PanelLeftClose, ZoomIn, ZoomOut, Maximize2, PanelRightOpen, Undo2, Redo2, SkipBack, SkipForward, Play, Pause, Film, Mic, Type, Music2 } from "lucide-react";
import { useSidebar } from "@/components/sidebar-context";
import type { FFmpeg } from "@ffmpeg/ffmpeg";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const PIXELS_PER_SECOND = 200;
const TRACK_HEIGHT = 44;
const TRANSITION_LABELS: Record<string, string> = {
  fade: "Fade", slideLeft: "◀", slideRight: "▶", wipe: "Wipe",
  zoom: "Zoom", pushUp: "▲", pushDown: "▼", blur: "Blur", spin: "↻", flip: "⇄",
};
const RULER_HEIGHT = 24;
const SCENE_BLOCK_MIN_WIDTH = 88;
const SNAP_GRID_SEC = 0.5;
const PLAYHEAD_COLOR = "#ef4444";
const RESIZE_HANDLE_WIDTH = 8;

/**
 * `public/ffmpeg-core/*` = wasm core from postinstall.
 * `public/ffmpeg-wasm/*` = unbundled `worker.js` + deps — required so Next/webpack does not rewrite
 * the worker’s dynamic `import()` (both http and blob core URLs then fail with “Cannot find module”).
 */
const FFMPEG_CORE_PUBLIC_PATH = "/ffmpeg-core";
const FFMPEG_WORKER_PUBLIC_PATH = "/ffmpeg-wasm/worker.js";

type WordTiming = { word: string; start: number; end: number };
type CaptionBlock = { id: string; text: string; startTime: number; endTime: number; wordTimings?: WordTiming[] };

type SceneBlock = { id: string; text: string; startTime: number; endTime: number; colorClass: string };

/** Element position/size: x,y in 0–100 (percent of container). */
type ElementPosition = { x: number; y: number };
type ElementSize = { w: number; h: number };

type BackgroundElement = { id: string; type: "background"; media: { url: string; type: "image" | "video" } | null };
type TextElement = { id: string; type: "text"; content: string; position: ElementPosition; fontSize: number; color: string };
type ImageElement = { id: string; type: "image"; media: { url: string }; position: ElementPosition; size: ElementSize };
type GraphicElement = { id: string; type: "graphic"; shape: string; color: string; size?: number };
type StickerElement = { id: string; type: "sticker"; media?: { url: string }; position: ElementPosition; size?: number };

type SceneElement = BackgroundElement | TextElement | ImageElement | GraphicElement | StickerElement;

const ELEMENT_TYPES = {
  BACKGROUND: "background",
  TEXT: "text",
  IMAGE: "image",
  GRAPHIC: "graphic",
  STICKER: "sticker",
} as const;

type Scene = {
  id: string;
  title: string;
  duration: number;
  color: string;
  elements: SceneElement[];
  /** e.g. zoom in, pan left, fade (from AI Coach image prompts) */
  animationType?: string | null;
  /** Start time in seconds (for drag-to-reposition). If set, block is position-based; else derived from order. */
  startTime?: number;
  /** Per-clip audio (e.g. voiceover from Template Studio). When set, used for this clip in playback and export. */
  audioUrl?: string | null;
};

function isBackgroundEl(el: SceneElement): el is BackgroundElement {
  return el.type === "background";
}
function isTextEl(el: SceneElement): el is TextElement {
  return el.type === "text";
}
function isImageEl(el: SceneElement): el is ImageElement {
  return el.type === "image";
}
function isGraphicEl(el: SceneElement): el is GraphicElement {
  return el.type === "graphic";
}
function isStickerEl(el: SceneElement): el is StickerElement {
  return el.type === "sticker";
}

type SceneAsset =
  | { startTime: number; duration: number; type: "image"; file: string; audioUrl?: string | null; captionText?: string; captionStartTime?: number; captionEndTime?: number }
  | { startTime: number; duration: number; type: "video"; file: string; audioUrl?: string | null; captionText?: string; captionStartTime?: number; captionEndTime?: number }
  | { startTime: number; duration: number; type: "color"; color: string; audioUrl?: string | null; captionText?: string; captionStartTime?: number; captionEndTime?: number };

const DEFAULT_SCENE_COLOR = "#1a1a1a";

const SCENE_COLOR_HEX = ["#2563eb", "#9333ea", "#16a34a", "#ea580c", "#db2777"];
const SCENE_COLORS = ["#3b82f6", "#a855f7", "#22c55e", "#f97316", "#ec4899"];

const VIDEO_TEMPLATES = [
  {
    id: "tiktok-short",
    name: "TikTok / Stories",
    description: "Full-screen vertical 9:16 — TikTok, IG Stories, Reels",
    durationRange: [5, 60] as [number, number],
    sceneRange: [1, 10] as [number, number],
    defaultDuration: 15,
    defaultSceneCount: 3,
    aspectRatio: "9:16",
    icon: "📱",
  },
  {
    id: "instagram-reel",
    name: "Instagram Reel",
    description: "Vertical reels with dynamic scenes",
    durationRange: [15, 60] as [number, number],
    sceneRange: [3, 10] as [number, number],
    defaultDuration: 30,
    defaultSceneCount: 5,
    aspectRatio: "9:16",
    icon: "📸",
  },
  {
    id: "youtube-short",
    name: "YouTube Short",
    description: "Short vertical video with 6-8 scenes",
    durationRange: [30, 90] as [number, number],
    sceneRange: [5, 15] as [number, number],
    defaultDuration: 60,
    defaultSceneCount: 7,
    aspectRatio: "9:16",
    icon: "▶️",
  },
  {
    id: "youtube-longform",
    name: "YouTube Video",
    description: "In-depth horizontal content",
    durationRange: [60, 600] as [number, number],
    sceneRange: [5, 30] as [number, number],
    defaultDuration: 120,
    defaultSceneCount: 10,
    aspectRatio: "16:9",
    icon: "🎬",
  },
  {
    id: "custom",
    name: "Custom",
    description: "Build from scratch",
    durationRange: [5, 600] as [number, number],
    sceneRange: [1, 30] as [number, number],
    defaultDuration: 30,
    defaultSceneCount: 5,
    aspectRatio: "9:16",
    icon: "⚙️",
  },
] as const;

type VideoTemplate = (typeof VIDEO_TEMPLATES)[number];

/** One-click caption style presets */
const CAPTION_PRESETS = [
  { name: "Text only", position: "bottom" as const, fontSize: "medium" as const, textColor: "#ffffff", animation: "fadeIn" as const, background: "none" as const, displayMode: "full" as const },
  { name: "Classic", position: "bottom" as const, fontSize: "medium" as const, textColor: "#ffffff", animation: "fadeIn" as const, background: "pill" as const, displayMode: "full" as const },
  { name: "Yellow subs", position: "bottom" as const, fontSize: "medium" as const, textColor: "#facc15", animation: "slideUp" as const, background: "none" as const, displayMode: "full" as const },
  { name: "Bold black", position: "middle" as const, fontSize: "large" as const, textColor: "#000000", animation: "pop" as const, background: "pill" as const, displayMode: "full" as const },
  { name: "Minimal", position: "top" as const, fontSize: "small" as const, textColor: "#e5e5e5", animation: "none" as const, background: "none" as const, displayMode: "full" as const },
  { name: "Karaoke bar", position: "bottom" as const, fontSize: "large" as const, textColor: "#ffffff", animation: "slideUp" as const, background: "bar" as const, displayMode: "full" as const },
  { name: "Soft white", position: "bottom" as const, fontSize: "medium" as const, textColor: "#fafafa", animation: "fadeIn" as const, background: "pill" as const, displayMode: "full" as const },
  { name: "Word by word", position: "bottom" as const, fontSize: "medium" as const, textColor: "#ffffff", animation: "fadeIn" as const, background: "pill" as const, displayMode: "wordByWord" as const },
  { name: "Single word", position: "bottom" as const, fontSize: "large" as const, textColor: "#ffffff", animation: "pop" as const, background: "pill" as const, displayMode: "singleWord" as const },
] as const;

function getActiveScene(
  currentTime: number,
  scenes: SceneBlock[]
): { scene: SceneBlock; index: number } | null {
  if (scenes.length === 0) return null;
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    if (currentTime >= scene.startTime && currentTime < scene.endTime) {
      return { scene, index: i };
    }
  }
  // Before first scene: show first scene
  if (currentTime < scenes[0].startTime) return { scene: scenes[0], index: 0 };
  // Past last scene: show last scene (hold last frame)
  if (currentTime >= scenes[scenes.length - 1].endTime) return { scene: scenes[scenes.length - 1], index: scenes.length - 1 };
  // In a gap: show the PREVIOUS scene (hold last frame) so we never show a blank/next scene with no media
  const firstAfter = scenes.findIndex((s) => s.endTime > currentTime);
  if (firstAfter > 0) return { scene: scenes[firstAfter - 1], index: firstAfter - 1 };
  return { scene: scenes[0], index: 0 };
}

function getScenePreviewColor(index: number): string {
  return SCENE_COLORS[index % SCENE_COLORS.length] ?? DEFAULT_SCENE_COLOR;
}

function getActiveCaption(
  currentTime: number,
  captions: CaptionBlock[]
): CaptionBlock | null {
  for (let i = 0; i < captions.length; i++) {
    const c = captions[i];
    if (currentTime >= c.startTime && currentTime <= c.endTime) {
      return c;
    }
  }
  return null;
}

/** For per-clip audio: at time t, return the block and its scene (with optional audioUrl). */
function getActiveBlockAndScene(
  sceneBlocks: SceneBlock[],
  sceneList: Scene[],
  t: number
): { block: SceneBlock; scene: Scene } | null {
  const active = getActiveScene(t, sceneBlocks);
  if (!active) return null;
  const scene = sceneList.find((s) => s.id === active.scene.id);
  return scene ? { block: active.scene, scene } : null;
}

type ScriptContent = {
  /** Primary: full timeline voiceover URL (set by Video Creation Guide when user generates voiceover). */
  timelineVoiceoverUrl?: string;
  timelineVoiceoverDuration?: number;
  /** Alternate names some scripts might use (fallbacks for compatibility). */
  voiceoverUrl?: string;
  timelineSceneVoiceoverUrls?: string[];
  sceneVoiceovers?: string[];
  captions?: Array<{ id?: string; text?: string; startTime?: number; endTime?: number }>;
  scenes?: Array<{ scene?: string; prompt?: string; timing?: string; [key: string]: unknown }>;
  scenePrompts?: Array<{ scene?: string; prompt?: string; timing?: string; [key: string]: unknown }>;
  [key: string]: unknown;
};

/** Resolve voiceover URL from script content. Timeline expects content.timelineVoiceoverUrl; fallbacks for other stored shapes. */
function getVoiceoverUrl(content: ScriptContent): string | null {
  const u = content.timelineVoiceoverUrl;
  if (typeof u === "string" && u.trim()) return u.trim();
  const v = content.voiceoverUrl;
  if (typeof v === "string" && v.trim()) return v.trim();
  const arr = content.timelineSceneVoiceoverUrls ?? content.sceneVoiceovers;
  if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === "string" && arr[0].trim()) return arr[0].trim();
  return null;
}

const SCENE_COLOR_CLASSES = [
  "bg-blue-600/80",
  "bg-purple-600/80",
  "bg-green-600/80",
  "bg-orange-600/80",
  "bg-pink-600/80",
];

const TEMPLATES = {
  "short-form-tiktok": {
    name: "TikTok Short (15s)",
    duration: 15,
    sceneCount: 3,
    defaultSceneDuration: 5,
    aspectRatio: "9:16",
    durationRange: [5, 60] as [number, number],
    sceneRange: [1, 10] as [number, number],
  },
  "short-form-instagram": {
    name: "Instagram Reel (30s)",
    duration: 30,
    sceneCount: 5,
    defaultSceneDuration: 6,
    aspectRatio: "9:16",
    durationRange: [15, 60] as [number, number],
    sceneRange: [2, 10] as [number, number],
  },
  "longform-youtube": {
    name: "YouTube Video (60s+)",
    duration: 90,
    sceneCount: 8,
    defaultSceneDuration: 11.25,
    aspectRatio: "16:9",
    durationRange: [30, 120] as [number, number],
    sceneRange: [3, 15] as [number, number],
  },
} as const;

const DEFAULT_NEW_SCENE_DURATION = 5;

function truncateSceneText(s: string, maxLen: number): string {
  const t = typeof s === "string" ? s.trim() : "";
  if (!t) return "—";
  return t.length <= maxLen ? t : t.slice(0, maxLen).trim() + "…";
}

function getSceneFullTexts(content: ScriptContent): string[] {
  const raw = content.scenes ?? content.scenePrompts;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.map((item, i) => {
    const text =
      (typeof (item as { scene?: string }).scene === "string" && (item as { scene: string }).scene.trim()) ||
      (typeof (item as { prompt?: string }).prompt === "string" && (item as { prompt: string }).prompt.trim()) ||
      `Scene ${i + 1}`;
    return text;
  });
}

function buildSceneBlocks(fullTexts: string[], duration: number): SceneBlock[] {
  if (fullTexts.length === 0 || !(duration > 0)) return [];
  const segment = duration / fullTexts.length;
  return fullTexts.map((fullText, i) => ({
    id: `scene-${i}`,
    text: truncateSceneText(fullText, 25),
    startTime: i * segment,
    endTime: (i + 1) * segment,
    colorClass: SCENE_COLOR_CLASSES[i % SCENE_COLOR_CLASSES.length],
  }));
}

function getSceneBackgroundMedia(scene: Scene): { url: string; type: "image" | "video" } | null {
  const first = Array.isArray(scene.elements) ? scene.elements[0] : undefined;
  return first && isBackgroundEl(first) ? first.media : null;
}

/** Library/API may store per-scene voice as voiceover_url; timeline uses audioUrl. */
function normalizeSceneClipAudioUrl(scene: Scene): Scene {
  const a = scene.audioUrl?.trim();
  if (a) return scene;
  const o = scene as Scene & { voiceover_url?: string; voiceoverUrl?: string };
  const fb = (
    typeof o.voiceover_url === "string" ? o.voiceover_url : typeof o.voiceoverUrl === "string" ? o.voiceoverUrl : ""
  ).trim();
  return fb ? { ...scene, audioUrl: fb } : scene;
}

function buildTimelineFromStickmanMetadata(rawScenes: unknown[]): { scenes: Scene[]; captions: CaptionBlock[]; totalDuration: number } {
  const fallbackDuration = 12;
  let runStart = 0;
  const sceneRows = rawScenes
    .map((raw, idx) => {
      if (!raw || typeof raw !== "object") return null;
      const node = raw as Record<string, unknown>;
      const caption = typeof node.caption === "string" ? node.caption.trim() : "";
      const duration =
        typeof node.duration === "number" && Number.isFinite(node.duration) && node.duration > 0
          ? node.duration
          : fallbackDuration;
      const id = `stickman-migrated-${idx + 1}`;
      const scene: Scene = {
        id,
        title: (caption || `Scene ${idx + 1}`).slice(0, 80),
        duration,
        color: SCENE_COLOR_HEX[idx % SCENE_COLOR_HEX.length] ?? DEFAULT_SCENE_COLOR,
        startTime: runStart,
        elements: [{
          id: `${id}-bg`,
          type: ELEMENT_TYPES.BACKGROUND,
          media: {
            type: "image",
            url: renderStickmanSceneDataUrl({
              caption,
              pose: typeof node.pose === "string" ? node.pose : undefined,
              keyObject: typeof node.keyObject === "string" ? node.keyObject : undefined,
              layout: typeof node.layout === "string" ? node.layout : undefined,
            }),
          },
        }],
      };
      runStart += duration;
      return { scene, caption };
    })
    .filter((item): item is { scene: Scene; caption: string } => item !== null);

  const scenes = sceneRows.map((item) => item.scene);
  const captions: CaptionBlock[] = sceneRows
    .map((item, idx) => {
      const text = item.caption.trim();
      if (!text) return null;
      const startTime = typeof item.scene.startTime === "number" ? item.scene.startTime : 0;
      return {
        id: `cap-stickman-migrated-${idx + 1}`,
        text,
        startTime,
        endTime: startTime + item.scene.duration,
      };
    })
    .filter((row): row is CaptionBlock => row !== null);

  return {
    scenes,
    captions,
    totalDuration: scenes.reduce((sum, scene) => sum + (Number(scene.duration) || 0), 0),
  };
}

function renderStickmanSceneDataUrl(input: { caption: string; pose?: string; keyObject?: string; layout?: string }): string {
  const text = (input.caption || "").slice(0, 210).replace(/[<>&"]/g, "");
  const left = input.layout === "right-presenter" ? 900 : input.layout === "center-presenter" ? 640 : 460;
  const pose = input.pose ?? "standing";
  const armY = pose === "pointing" ? 468 : pose === "celebrating" ? 410 : 452;
  const icon = input.keyObject === "money" ? "$" : input.keyObject === "warning" ? "!" : input.keyObject === "clock" ? "O" : input.keyObject === "chart" ? "/" : "*";
  const dots: string[] = [];
  for (let y = 28; y <= 690; y += 28) {
    for (let x = 28; x <= 1250; x += 28) {
      dots.push(`<circle cx="${x}" cy="${y}" r="1.6" fill="#d8cfb5" opacity="0.38" />`);
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#FFFEF8"/>
  ${dots.join("")}
  <rect x="0" y="0" width="1280" height="10" fill="#F59E0B"/>
  <rect x="80" y="85" width="720" height="170" rx="16" fill="#f8e8d8" opacity="0.85"/>
  <text x="110" y="150" font-family="Caveat, Arial, sans-serif" font-size="58" font-weight="700" fill="#b45309">In a world obsessed with personal branding...</text>
  <text x="110" y="215" font-family="Caveat, Arial, sans-serif" font-size="46" fill="#111827">${text}</text>
  <line x1="80" y1="505" x2="1200" y2="505" stroke="#8f8f8f" stroke-width="14" stroke-linecap="round" opacity="0.6"/>
  <circle cx="${left}" cy="360" r="26" fill="none" stroke="#1f2937" stroke-width="8"/>
  <line x1="${left}" y1="386" x2="${left}" y2="468" stroke="#1f2937" stroke-width="8" stroke-linecap="round"/>
  <line x1="${left}" y1="420" x2="${left - 58}" y2="${armY}" stroke="#1f2937" stroke-width="8" stroke-linecap="round"/>
  <line x1="${left}" y1="420" x2="${left + 82}" y2="${armY}" stroke="#1f2937" stroke-width="8" stroke-linecap="round"/>
  <line x1="${left}" y1="468" x2="${left - 45}" y2="548" stroke="#1f2937" stroke-width="8" stroke-linecap="round"/>
  <line x1="${left}" y1="468" x2="${left + 45}" y2="548" stroke="#1f2937" stroke-width="8" stroke-linecap="round"/>
  <rect x="${left + 95}" y="322" width="195" height="140" rx="10" fill="none" stroke="#111827" stroke-width="6"/>
  <line x1="${left + 120}" y1="430" x2="${left + 260}" y2="430" stroke="#111827" stroke-width="5"/>
  <line x1="${left + 120}" y1="430" x2="${left + 120}" y2="350" stroke="#111827" stroke-width="5"/>
  <line x1="${left + 132}" y1="416" x2="${left + 170}" y2="385" stroke="#111827" stroke-width="5"/>
  <line x1="${left + 170}" y1="385" x2="${left + 230}" y2="350" stroke="#111827" stroke-width="5"/>
  <circle cx="${left + 250}" cy="392" r="14" fill="#f97316"/>
  <text x="${left + 248}" y="368" font-family="Arial, sans-serif" font-size="34" font-weight="800" fill="#f59e0b">${icon}</text>
  <text x="1135" y="662" font-family="Caveat, Arial, sans-serif" font-size="34" fill="#b45309">1 / 39</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function isRenderableTimelineScene(raw: unknown): raw is Scene {
  if (!raw || typeof raw !== "object") return false;
  const scene = raw as Record<string, unknown>;
  return typeof scene.duration === "number" && scene.duration > 0 && Array.isArray(scene.elements);
}

function migrateLegacyScenesList(rawScenes: unknown[]): { scenes: Scene[]; captions: CaptionBlock[]; totalDuration: number } {
  const fallbackDuration = 12;
  let runStart = 0;
  const scenes: Scene[] = [];
  const captions: CaptionBlock[] = [];

  rawScenes.forEach((raw, idx) => {
    if (!raw || typeof raw !== "object") return;
    const node = raw as Record<string, unknown>;
    const caption =
      typeof node.caption === "string"
        ? node.caption.trim()
        : typeof node.title === "string"
          ? node.title.trim()
          : "";
    const duration =
      typeof node.duration === "number" && Number.isFinite(node.duration) && node.duration > 0
        ? node.duration
        : fallbackDuration;
    const id = typeof node.id === "string" && node.id.trim() ? node.id : `scene-migrated-${idx + 1}`;
    const startTime =
      typeof node.startTime === "number" && Number.isFinite(node.startTime) && node.startTime >= 0
        ? node.startTime
        : runStart;
    const scene: Scene = {
      id,
      title: (caption || `Scene ${idx + 1}`).slice(0, 80),
      duration,
      color: SCENE_COLOR_HEX[idx % SCENE_COLOR_HEX.length] ?? DEFAULT_SCENE_COLOR,
      startTime,
      elements: [{
        id: `${id}-bg`,
        type: ELEMENT_TYPES.BACKGROUND,
        media: {
          type: "image",
          url: renderStickmanSceneDataUrl({
            caption,
            pose: typeof node.pose === "string" ? node.pose : undefined,
            keyObject: typeof node.keyObject === "string" ? node.keyObject : undefined,
            layout: typeof node.layout === "string" ? node.layout : undefined,
          }),
        },
      }],
    };
    scenes.push(scene);
    if (caption) {
      captions.push({
        id: `cap-migrated-${idx + 1}`,
        text: caption,
        startTime,
        endTime: startTime + duration,
      });
    }
    runStart = startTime + duration;
  });

  return {
    scenes,
    captions,
    totalDuration: scenes.reduce((sum, scene) => sum + (Number(scene.duration) || 0), 0),
  };
}

function buildSceneBlocksFromScenes(sceneList: Scene[]): SceneBlock[] {
  if (sceneList.length === 0) return [];
  const withStart = sceneList.map((scene, i) => {
    const start = typeof scene.startTime === "number" ? scene.startTime : null;
    return { scene, i, start };
  });
  let runningStart = 0;
  const blocks: SceneBlock[] = withStart.map(({ scene, i }) => {
    const startTime = typeof scene.startTime === "number" ? scene.startTime : runningStart;
    const endTime = startTime + scene.duration;
    if (typeof scene.startTime !== "number") runningStart = endTime;
    return {
      id: scene.id,
      text: truncateSceneText(scene.title, 25),
      startTime,
      endTime,
      colorClass: SCENE_COLOR_CLASSES[i % SCENE_COLOR_CLASSES.length],
    };
  });
  return blocks.slice().sort((a, b) => a.startTime - b.startTime);
}

/** Pack scenes back-to-back from t=0 in timeline order (removes blank gaps between scenes and lead-in). Returns same reference if nothing to fix. */
function collapseAllSceneGapsToContiguous(sceneList: Scene[]): Scene[] {
  if (sceneList.length === 0) return sceneList;
  const blocks = buildSceneBlocksFromScenes(sceneList).sort((a, b) => a.startTime - b.startTime);
  let t = 0;
  const idToTiming = new Map<string, { startTime: number; duration: number }>();
  for (const b of blocks) {
    const dur = Math.max(0.5, b.endTime - b.startTime);
    idToTiming.set(b.id, { startTime: t, duration: dur });
    t += dur;
  }
  let changed = false;
  const next = sceneList.map((scene) => {
    const u = idToTiming.get(scene.id);
    if (!u) return scene;
    const b = blocks.find((x) => x.id === scene.id);
    if (!b) return scene;
    if (Math.abs(b.startTime - u.startTime) > 0.02 || Math.abs(b.endTime - b.startTime - u.duration) > 0.02) changed = true;
    return { ...scene, startTime: u.startTime, duration: u.duration };
  });
  return changed ? next : sceneList;
}

function createScene(id: string, title: string, duration: number, color: string, startTime?: number, audioUrl?: string | null): Scene {
  return {
    id,
    title,
    duration,
    color,
    elements: [{ id: `${id}-bg`, type: ELEMENT_TYPES.BACKGROUND, media: null }],
    ...(typeof startTime === "number" ? { startTime } : {}),
    ...(audioUrl != null && audioUrl !== "" ? { audioUrl } : {}),
  };
}

function createSceneWithBackground(
  id: string,
  title: string,
  duration: number,
  color: string,
  imageUrl: string | null,
  videoUrl?: string | null,
  animationType?: string | null,
  startTime?: number,
  audioUrl?: string | null
): Scene {
  const media =
    videoUrl && videoUrl.trim()
      ? { url: videoUrl.trim(), type: "video" as const }
      : imageUrl && imageUrl.trim()
        ? { url: imageUrl.trim(), type: "image" as const }
        : null;
  return {
    id,
    title,
    duration,
    color,
    elements: [{ id: `${id}-bg`, type: ELEMENT_TYPES.BACKGROUND, media }],
    ...(animationType != null && animationType !== "" ? { animationType } : {}),
    ...(typeof startTime === "number" ? { startTime } : {}),
    ...(audioUrl != null && audioUrl !== "" ? { audioUrl } : {}),
  };
}

function collectSceneAssets(
  sceneBlocks: SceneBlock[],
  sceneList: Scene[],
  captions: CaptionBlock[]
): SceneAsset[] {
  const sorted = sceneBlocks.slice().sort((a, b) => a.startTime - b.startTime);
  return sorted.map((block) => {
    const startTime = block.startTime;
    const endTime = block.endTime;
    const duration = Math.max(0, endTime - startTime);
    const scene = sceneList.find((s) => s.id === block.id);
    const media = scene ? getSceneBackgroundMedia(scene) : null;

    const overlappingCaption = captions.find(
      (c) => c.startTime < endTime && c.endTime > startTime
    );
    const captionStartTime = overlappingCaption
      ? Math.max(overlappingCaption.startTime, startTime)
      : undefined;
    const captionEndTime = overlappingCaption
      ? Math.min(overlappingCaption.endTime, endTime)
      : undefined;
    /** Full dialogue line (e.g. "Name: …") for burned-in export captions */
    const captionText = overlappingCaption
      ? overlappingCaption.text.replace(/\r?\n/g, " ").trim()
      : undefined;

    const clipAudioUrl = scene?.audioUrl && scene.audioUrl.trim() ? scene.audioUrl.trim() : undefined;
    if (media && media.url) {
      return {
        startTime,
        duration,
        type: media.type,
        file: media.url,
        ...(clipAudioUrl != null && { audioUrl: clipAudioUrl }),
        ...(captionText !== undefined && { captionText, captionStartTime, captionEndTime }),
      };
    }
    return {
      startTime,
      duration,
      type: "color",
      color: DEFAULT_SCENE_COLOR,
      ...(clipAudioUrl != null && { audioUrl: clipAudioUrl }),
      ...(captionText !== undefined && { captionText, captionStartTime, captionEndTime }),
    };
  });
}

function validateSceneAssets(assets: SceneAsset[]): { valid: boolean; error?: string } {
  if (assets.length === 0) {
    return { valid: false, error: "No scenes to export" };
  }
  for (let i = 0; i < assets.length; i++) {
    const a = assets[i];
    if (a.duration <= 0) {
      return { valid: false, error: `Scene ${i + 1} has invalid duration` };
    }
    if (a.type === "image" || a.type === "video") {
      if (!a.file || typeof a.file !== "string") {
        return { valid: false, error: `Scene ${i + 1} is missing media file` };
      }
    }
    if (a.type === "color" && !a.color) {
      return { valid: false, error: `Scene ${i + 1} color fallback is missing` };
    }
  }
  return { valid: true };
}

const EXPORT_WIDTH = 1080;
const EXPORT_HEIGHT = 1920;

function hexToFfmpeg(hex: string): string {
  const s = hex.replace(/^#/, "");
  if (s.length === 6) return `0x${s}`;
  if (s.length === 8) return `0x${s.slice(6)}${s.slice(0, 6)}`;
  return "0xffffff";
}

type ExportCaptionStyle = {
  position: "bottom" | "middle" | "top";
  fontSize: "small" | "medium" | "large";
  textColor: string;
  animation: "none" | "fadeIn" | "slideUp" | "pop";
};

function buildExportFilterComplex(
  assets: SceneAsset[],
  hasMusic: boolean,
  captionStyle: ExportCaptionStyle,
  /** When using per-clip audio, scene files start after clip audios + optional music. Otherwise 1 (voiceover only) or 2 (voiceover + music). */
  firstSceneInputIndex?: number
): { filter: string; videoLabel: string } {
  const firstSceneInputIndexResolved = firstSceneInputIndex ?? (hasMusic ? 2 : 1);
  let fileIndex = 0;
  const segmentLabels: string[] = [];
  const parts: string[] = [];

  for (let i = 0; i < assets.length; i++) {
    const a = assets[i];
    const dur = a.duration;
    if (a.type === "color") {
      const hex = hexToFfmpeg(a.color);
      parts.push(
        `color=c=${hex}:s=${EXPORT_WIDTH}x${EXPORT_HEIGHT}:d=${dur},format=yuv420p[v${i}]`
      );
    } else {
      const idx = firstSceneInputIndexResolved + fileIndex;
      fileIndex += 1;
      parts.push(
        `[${idx}:v]scale=${EXPORT_WIDTH}:${EXPORT_HEIGHT}:force_original_aspect_ratio=decrease,pad=${EXPORT_WIDTH}:${EXPORT_HEIGHT}:(ow-iw)/2:(oh-ih)/2,setsar=1,trim=duration=${dur},setpts=PTS-STARTPTS,format=yuv420p[v${i}]`
      );
    }
    segmentLabels.push(`[v${i}]`);
  }

  const concatLabel = segmentLabels.join("");
  parts.push(`${concatLabel}concat=n=${assets.length}:v=1:a=0[vout]`);

  const viralFs =
    captionStyle.fontSize === "large"
      ? VIRAL_CAPTION_FONT_SIZES.large
      : captionStyle.fontSize === "small"
        ? VIRAL_CAPTION_FONT_SIZES.small
        : VIRAL_CAPTION_FONT_SIZES.medium;
  const viralBottomPad = VIRAL_CAPTION_BOTTOM_PAD;
  const viralBaseY = `h-text_h-${viralBottomPad}`;
  const anim = captionStyle.animation;

  let videoLabel = "vout";
  const captionParts: string[] = [];
  for (let i = 0; i < assets.length; i++) {
    const a = assets[i];
    if (a.captionText == null || a.captionText.trim() === "" || a.captionStartTime == null || a.captionEndTime == null) continue;
    const fullLine = a.captionText.trim();
    const start = a.captionStartTime;
    const end = a.captionEndTime;
    const nextLabel = `vc${i}`;
    const enable = `between(t\\,${start}\\,${end})`;
    let yExpr = viralBaseY;
    let alphaExpr: string | undefined = undefined;
    if (anim === "fadeIn" || anim === "pop") {
      const fadeDur = 0.4;
      alphaExpr = `if(lt(t\\,${start + fadeDur})\\,(t-${start})/${fadeDur}\\,1)`;
    }
    if (anim === "slideUp" || anim === "pop") {
      const slideDur = 0.35;
      const offset = 60;
      yExpr = `if(lt(t\\,${start + slideDur})\\,h-text_h-${viralBottomPad}+${offset}*(1-(t-${start})/${slideDur})\\,h-text_h-${viralBottomPad})`;
    }
    captionParts.push(
      buildViralCaptionDrawtextChain(videoLabel, nextLabel, {
        videoWidth: EXPORT_WIDTH,
        dialogueLine: fullLine,
        fontSize: viralFs,
        bottomPadPx: viralBottomPad,
        yExpr,
        enableExpr: enable,
        alphaExpr,
        midLabel: `vcap_mid_${i}`,
      })
    );
    videoLabel = nextLabel;
  }

  if (captionParts.length > 0) {
    parts.push(captionParts.join(";"));
  }

  return { filter: parts.join(";"), videoLabel };
}

function hasAssetAudioUrl(a: SceneAsset): a is SceneAsset & { audioUrl: string } {
  return "audioUrl" in a && !!a.audioUrl && typeof (a as { audioUrl?: string }).audioUrl === "string";
}

async function exportVideo(params: {
  ffmpeg: FFmpeg;
  fetchFile: (url: string) => Promise<Uint8Array>;
  /** Global voiceover; when null/empty, per-clip audio (asset.audioUrl) is used if present. */
  voiceoverUrl: string | null;
  musicUrl: string | null;
  musicVolume: number;
  assets: SceneAsset[];
  captionStyle: ExportCaptionStyle;
  totalDuration: number;
  onProgress: (p: number) => void;
}): Promise<Uint8Array> {
  const { ffmpeg, fetchFile, voiceoverUrl, musicUrl, musicVolume, assets, captionStyle, totalDuration, onProgress } = params;

  const usePerClipAudio = !voiceoverUrl?.trim() && assets.some(hasAssetAudioUrl);
  const clipAudioAssets = usePerClipAudio ? assets.filter(hasAssetAudioUrl) : [];

  if (!voiceoverUrl?.trim() && !usePerClipAudio) {
    throw new Error("No audio for export: set a voiceover or use scenes with per-clip audio.");
  }

  const progressHandler = ({ message }: { message: string }) => {
    const m = message.match(/time=(\d+):(\d+):(\d+)\.(\d+)/);
    if (m) {
      const h = parseInt(m[1], 10);
      const min = parseInt(m[2], 10);
      const sec = parseFloat(`${m[3]}.${m[4]}`);
      const t = h * 3600 + min * 60 + sec;
      const p = totalDuration > 0 ? Math.min(99, (t / totalDuration) * 100) : 0;
      onProgress(p);
    }
  };
  ffmpeg.on("log", progressHandler);

  try {
    console.log("[exportVideo] Starting export...", usePerClipAudio ? "(per-clip audio)" : "(global voiceover)");

    if (usePerClipAudio) {
      for (let i = 0; i < clipAudioAssets.length; i++) {
        const a = clipAudioAssets[i];
        const name = `clip_audio_${i}.mp3`;
        const data = await fetchFile(a.audioUrl);
        await ffmpeg.writeFile(name, data);
        console.log("[exportVideo] Clip audio", i, "written, startTime=" + a.startTime + "s, size:", data.byteLength);
      }
    } else {
      console.log("[exportVideo] Writing voiceover to ffmpeg FS...");
      const voiceoverData = await fetchFile(voiceoverUrl!);
      await ffmpeg.writeFile("voiceover.mp3", voiceoverData);
      console.log("[exportVideo] Voiceover written, size:", voiceoverData.byteLength, "bytes");
    }

    if (musicUrl) {
      console.log("[exportVideo] Writing music to ffmpeg FS...");
      const musicData = await fetchFile(musicUrl);
      await ffmpeg.writeFile("music.mp3", musicData);
      console.log("[exportVideo] Music written, size:", musicData.byteLength, "bytes");
    }

    console.log("[exportVideo] Building scene inputs...");
    let fileIndex = 0;
    for (let i = 0; i < assets.length; i++) {
      const a = assets[i];
      console.log("[exportVideo] Scene", i, ": type=" + a.type + ", duration=" + a.duration + (a.type === "color" ? ", color=" + (a as { color: string }).color : ""));
      if (a.type === "image") {
        const name = `scene_${fileIndex}.png`;
        await ffmpeg.writeFile(name, await fetchFile(a.file));
        fileIndex += 1;
      } else if (a.type === "video") {
        const name = `scene_${fileIndex}.mp4`;
        await ffmpeg.writeFile(name, await fetchFile(a.file));
        fileIndex += 1;
      }
    }
    console.log("[exportVideo] Scene files written:", fileIndex, "file(s). Color-only scenes use filter, no file.");

    const hasMusic = !!musicUrl;
    const numClipAudios = clipAudioAssets.length;
    const firstSceneInputIndex = usePerClipAudio ? numClipAudios + (hasMusic ? 1 : 0) : undefined;
    const { filter: videoFilter, videoLabel } = buildExportFilterComplex(assets, hasMusic, captionStyle, firstSceneInputIndex);
    const musicGain = Math.max(0, Math.min(1, musicVolume / 100));

    let fullFilter: string;
    let audioMap: string;
    const args: string[] = ["-y"];

    if (usePerClipAudio) {
      for (let i = 0; i < numClipAudios; i++) args.push("-i", `clip_audio_${i}.mp3`);
      if (hasMusic) args.push("-i", "music.mp3");
      const adelayParts = clipAudioAssets.map((a, i) => {
        const ms = Math.round(a.startTime * 1000);
        return `[${i}:a]adelay=${ms}|${ms}[a${i}]`;
      });
      const amixInputs = clipAudioAssets.map((_, i) => `[a${i}]`).join("");
      const clipMix = `${adelayParts.join(";")};${amixInputs}amix=inputs=${numClipAudios}:duration=longest[va]`;
      fullFilter = hasMusic
        ? `${videoFilter};${clipMix};[va]volume=1[va2];[${numClipAudios}:a]volume=${musicGain}[ma];[va2][ma]amix=inputs=2:duration=first[aout]`
        : `${videoFilter};${clipMix}`;
      audioMap = hasMusic ? "[aout]" : "[va]";
      console.log("[exportVideo] Audio: per-clip mix (" + numClipAudios + " clips)" + (hasMusic ? " + music at " + Math.round(musicGain * 100) + "%" : ""));
    } else {
      args.push("-i", "voiceover.mp3");
      if (hasMusic) args.push("-i", "music.mp3");
      fullFilter = hasMusic
        ? `${videoFilter};[0:a]volume=1[va];[1:a]volume=${musicGain}[ma];[va][ma]amix=inputs=2:duration=first[aout]`
        : videoFilter;
      audioMap = hasMusic ? "[aout]" : "0:a";
      console.log("[exportVideo] Audio: voiceover +", hasMusic ? "music at " + Math.round(musicGain * 100) + "%" : "no music");
    }

    fileIndex = 0;
    for (let i = 0; i < assets.length; i++) {
      const a = assets[i];
      if (a.type === "image") {
        args.push("-loop", "1", "-i", `scene_${fileIndex}.png`);
        fileIndex += 1;
      } else if (a.type === "video") {
        args.push("-i", `scene_${fileIndex}.mp4`);
        fileIndex += 1;
      }
    }
    args.push("-filter_complex", fullFilter, "-map", `[${videoLabel}]`, "-map", audioMap);
    args.push(
      "-c:v", "libx264",
      "-c:a", "aac",
      "-shortest",
      "-s", "540x960",
      "-r", "15",
      "-preset", "ultrafast",
      "-crf", "28",
      "output.mp4"
    );
    // TODO: remove -s/-r/-preset/-crf for final exports (full res, 30fps, default preset/crf)

    console.log("[exportVideo] Executing ffmpeg command:", JSON.stringify(args));
    await ffmpeg.exec(args);
    console.log("[exportVideo] Export complete, reading output...");
    onProgress(100);
    const data = await ffmpeg.readFile("output.mp4") as Uint8Array;
    console.log("[exportVideo] Output file size:", data.byteLength, "bytes");
    return data;
  } catch (error) {
    console.error("[exportVideo] Export error:", error);
    throw error;
  } finally {
    ffmpeg.off("log", progressHandler);
  }
}

/** Snap time to grid and to other block edges (for drag/resize). */
function snapTime(t: number, otherBlocks: SceneBlock[], excludeBlockId: string, maxDuration: number): number {
  const candidates: number[] = [0, maxDuration];
  for (let i = 0; i <= Math.ceil(maxDuration / SNAP_GRID_SEC); i++) {
    candidates.push(i * SNAP_GRID_SEC);
  }
  otherBlocks.forEach((b) => {
    if (b.id !== excludeBlockId) {
      candidates.push(b.startTime, b.endTime);
    }
  });
  const sorted = [...new Set(candidates)].sort((a, b) => a - b);
  let best = sorted[0];
  let bestDist = Math.abs(t - best);
  sorted.forEach((c) => {
    const d = Math.abs(t - c);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  });
  return Math.max(0, Math.min(maxDuration, best));
}

type EditableSceneBlockProps = {
  block: SceneBlock;
  sceneIndex: number;
  isSelected: boolean;
  onSelect: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
  durationSec: number;
  thumbnailUrl: string | null;
  timeToX: (t: number) => number;
  xToTime: (x: number) => number;
  effectiveDuration: number;
  updateSceneTiming: (id: string, u: { startTime?: number; duration?: number }) => void;
  onTimingChangeComplete?: () => void;
  otherBlocks: SceneBlock[];
  onDropFile?: (file: File) => void;
  onSetMedia?: (url: string, type: "image" | "video") => void;
};

function EditableSceneBlock({
  block,
  sceneIndex,
  isSelected,
  onSelect,
  expanded,
  onToggleExpand,
  durationSec,
  thumbnailUrl,
  timeToX,
  xToTime,
  effectiveDuration,
  updateSceneTiming,
  onTimingChangeComplete,
  otherBlocks,
  onDropFile,
  onSetMedia,
}: EditableSceneBlockProps) {
  const [dragState, setDragState] = useState<"move" | "resize-left" | "resize-right" | null>(null);
  const [dragTime, setDragTime] = useState<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const startXRef = useRef(0);
  const startStartRef = useRef(0);
  const startDurationRef = useRef(0);

  const leftPx = timeToX(block.startTime);
  const widthPx = Math.max(SCENE_BLOCK_MIN_WIDTH, timeToX(block.endTime) - leftPx);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, mode: "move" | "resize-left" | "resize-right") => {
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setDragState(mode);
      setDragTime(block.startTime);
      startXRef.current = e.clientX;
      startStartRef.current = block.startTime;
      startDurationRef.current = block.endTime - block.startTime;
    },
    [block.startTime, block.endTime]
  );

  useEffect(() => {
    if (dragState === null) return;
    const timelineEl = document.querySelector(".timeline-inner");
    const onMove = (e: PointerEvent) => {
      if (!timelineEl) return;
      const rect = timelineEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const t = xToTime(x);
      const snapped = snapTime(t, otherBlocks, block.id, effectiveDuration);
      setDragTime(snapped);
      if (dragState === "move") {
        const newStart = snapTime(snapped, otherBlocks, block.id, effectiveDuration);
        const dur = startDurationRef.current;
        updateSceneTiming(block.id, { startTime: Math.max(0, Math.min(newStart, effectiveDuration - dur)), duration: dur });
      } else if (dragState === "resize-left") {
        const endTime = startStartRef.current + startDurationRef.current;
        const newStart = Math.max(0, Math.min(snapped, endTime - 0.5));
        updateSceneTiming(block.id, { startTime: newStart, duration: endTime - newStart });
      } else {
        const newEnd = Math.max(startStartRef.current + 0.5, Math.min(effectiveDuration, snapped));
        updateSceneTiming(block.id, { duration: newEnd - startStartRef.current });
      }
    };
    const onUp = () => {
      if (dragState !== null) onTimingChangeComplete?.();
      setDragState(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragState, block.id, otherBlocks, effectiveDuration, xToTime, updateSceneTiming, onTimingChangeComplete]);

  return (
    <>
      <div
        data-sortable-scene
        role="button"
        tabIndex={0}
        className={`absolute top-1 bottom-1 rounded-md shadow-sm overflow-hidden text-xs text-white select-none flex flex-col items-center justify-center min-h-[2rem] ${thumbnailUrl ? "" : block.colorClass} ${
          isSelected ? "ring-2 ring-white ring-offset-1 ring-offset-[#111111] z-10" : "z-0"
        } hover:brightness-110 transition-[filter] ${expanded ? "min-h-[5rem] py-2" : "py-1.5 gap-0.5"} ${dragState ? "opacity-95" : ""} ${isDragOver ? "ring-2 ring-[#f97316] brightness-125" : ""}`}
        style={thumbnailUrl
          ? { left: leftPx, width: widthPx, minWidth: SCENE_BLOCK_MIN_WIDTH, backgroundImage: `url(${thumbnailUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
          : { left: leftPx, width: widthPx, minWidth: SCENE_BLOCK_MIN_WIDTH }
        }
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
          onToggleExpand();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
            onToggleExpand();
          }
        }}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault(); e.stopPropagation(); setIsDragOver(false);
          // Check left-panel drag first
          const mediaUrl = e.dataTransfer.getData("application/x-media-url");
          const mediaType = e.dataTransfer.getData("application/x-media-type") as "image" | "video";
          if (mediaUrl && onSetMedia) { onSetMedia(mediaUrl, mediaType); return; }
          // Then check file drop
          const file = e.dataTransfer.files?.[0];
          if (file && onDropFile && (file.type.startsWith('image/') || file.type.startsWith('video/'))) onDropFile(file);
        }}
      >
        {/* Dark overlay when thumbnail is shown */}
        {thumbnailUrl && <div className="absolute inset-0 bg-black/40 pointer-events-none" />}
        {/* Left resize handle */}
        <div
          className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize shrink-0 z-20 hover:bg-white/20"
          onPointerDown={(e) => handlePointerDown(e, "resize-left")}
          title="Drag to resize start"
        />
        {/* Body: drag to move */}
        <div
          className="absolute inset-0 cursor-grab active:cursor-grabbing flex flex-col items-center justify-center px-2 overflow-hidden relative z-10"
          style={{ left: RESIZE_HANDLE_WIDTH, right: RESIZE_HANDLE_WIDTH, minWidth: 0 }}
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest("[data-resize-handle]")) return;
            handlePointerDown(e, "move");
          }}
        >
          <span className="font-semibold truncate w-full text-center text-[11px] min-w-0" title={`Scene ${sceneIndex + 1}${block.text ? `: ${block.text}` : ""}`}>Scene {sceneIndex + 1}</span>
          {expanded ? (
            <>
              <span className="truncate w-full text-center text-white/90 text-[10px] leading-tight">{block.text}</span>
              {!thumbnailUrl && (
                <div className="mt-1 w-full h-8 rounded-md bg-black/20 shrink-0 flex items-center justify-center text-[10px] text-white/60">No image</div>
              )}
            </>
          ) : (
            <>
              <span className="truncate w-full text-center text-white/90 text-[10px] leading-tight min-w-0">{block.text || "\u00A0"}</span>
              {!thumbnailUrl && <span className="text-white/30 text-[10px]">+ Drop media</span>}
            </>
          )}
          <span className="absolute bottom-1 right-2 text-[9px] text-white/60 tabular-nums">{durationSec.toFixed(1)}s</span>
        </div>
        {/* Right resize handle */}
        <div
          data-resize-handle
          className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize shrink-0 z-20 hover:bg-white/20"
          onPointerDown={(e) => handlePointerDown(e, "resize-right")}
          title="Drag to resize end"
        />
      </div>
      {/* Duration/timestamp tooltip while dragging - above block */}
      {dragState !== null && (
        <div className="absolute left-1/2 -translate-x-1/2 -top-8 z-[100] px-2 py-1 rounded bg-primary text-primary-foreground text-xs font-medium shadow-lg pointer-events-none whitespace-nowrap">
          {dragState === "move" && dragTime !== null ? `${dragTime.toFixed(1)}s` : `${(block.endTime - block.startTime).toFixed(1)}s`}
        </div>
      )}
    </>
  );
}

function SortableSceneBlock({
  scene,
  index,
  widthPx,
  isSelected,
  onSelect,
  expanded,
  onToggleExpand,
  durationSec,
  thumbnailUrl,
}: {
  scene: SceneBlock;
  index: number;
  widthPx: number;
  isSelected: boolean;
  onSelect: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
  durationSec: number;
  thumbnailUrl: string | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: scene.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: widthPx,
    minWidth: Math.max(SCENE_BLOCK_MIN_WIDTH, widthPx),
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      data-sortable-scene
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
        onToggleExpand();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onSelect();
          onToggleExpand();
        }
      }}
      className={`relative flex-shrink-0 flex-grow-0 rounded-md shadow-sm overflow-hidden text-xs text-white cursor-grab active:cursor-grabbing select-none flex flex-col items-center justify-center min-h-[2rem] ${scene.colorClass} ${
        isSelected ? "ring-2 ring-white ring-offset-1 ring-offset-[#111111]" : ""
      } ${isDragging ? "opacity-90 z-50 shadow-lg cursor-grabbing" : ""} ${expanded ? "min-h-[5rem] py-2" : "py-1.5 px-2 gap-0.5"}`}
      title={scene.text}
      {...attributes}
      {...listeners}
    >
      <span className="font-semibold truncate w-full text-center px-1">Scene {index + 1}</span>
      {expanded ? (
        <>
          <span className="truncate w-full text-center text-white/90 text-[10px] leading-tight px-1">{scene.text}</span>
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt=""
              className="mt-1 w-full h-8 object-cover rounded-md shrink-0"
            />
          ) : (
            <div className="mt-1 w-full h-8 rounded-md bg-black/20 shrink-0 flex items-center justify-center text-[10px] text-white/60">No image</div>
          )}
        </>
      ) : (
        <span className="truncate w-full text-center text-white/90 text-[10px] leading-tight px-1">{scene.text}</span>
      )}
      <span className="absolute bottom-1 right-2 text-[9px] text-white/60 tabular-nums">{durationSec.toFixed(1)}s</span>
    </div>
  );
}

type LibraryScript = { id: string; title: string; type: "script" };
type LibraryResponse = { id: string; title: string; type: string }[];

function parseContent(content: unknown): ScriptContent {
  if (content == null) return {};
  if (typeof content === "object" && !Array.isArray(content)) return content as ScriptContent;
  if (typeof content === "string") {
    try {
      return JSON.parse(content) as ScriptContent;
    } catch {
      return {};
    }
  }
  return {};
}

/** Remove leading speaker label (e.g. "Narrator:", "Apple:") so only the line is shown. */
function stripSpeakerPrefix(text: string): string {
  return text.replace(/^\s*[^:]+:\s*/i, "").trim();
}

function getCaptions(content: ScriptContent): CaptionBlock[] {
  const raw = content.captions;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (c): c is { id?: string; text?: string; startTime: number; endTime: number } =>
        typeof c?.startTime === "number" && typeof c?.endTime === "number"
    )
    .map((c, i) => ({
      id: typeof c.id === "string" ? c.id : `cap-${i}`,
      text: typeof c.text === "string" ? c.text : "",
      startTime: c.startTime,
      endTime: c.endTime,
    }));
}

export default function VideoTimelinePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialScriptId = searchParams.get("scriptId") ?? searchParams.get("libraryScriptId") ?? undefined;

  const audioRef = useRef<HTMLAudioElement>(null);
  const musicRef = useRef<HTMLAudioElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);
  const [isBrowser, setIsBrowser] = useState(false);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const fetchFileRef = useRef<((url: string) => Promise<Uint8Array>) | null>(null);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  /** Set when browser FFmpeg fails to load (ChunkLoadError, wasm, etc.) */
  const [ffmpegLoadError, setFfmpegLoadError] = useState<string | null>(null);
  const [scriptId, setScriptId] = useState<string | undefined>(initialScriptId);
  const [scriptName, setScriptName] = useState("");
  const [scripts, setScripts] = useState<LibraryScript[]>([]);
  const [savedScripts, setSavedScripts] = useState<{ id: string; title: string }[]>([]);
  const [voiceoverUrl, setVoiceoverUrl] = useState<string | null>(null);
  const [voiceoverFileName, setVoiceoverFileName] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [captions, setCaptions] = useState<CaptionBlock[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [voiceoverDuration, setVoiceoverDuration] = useState(0);
  const [selectedSceneIndex, setSelectedSceneIndex] = useState<number | null>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const sceneMediaInputRef = useRef<HTMLInputElement>(null);
  const voiceoverInputRef = useRef<HTMLInputElement>(null);

  const [captionAnimation, setCaptionAnimation] = useState<"none" | "fadeIn" | "slideUp" | "pop">("fadeIn");
  const [captionPosition, setCaptionPosition] = useState<"bottom" | "middle" | "top">("bottom");
  const [captionFontSize, setCaptionFontSize] = useState<"small" | "medium" | "large">("medium");
  const [captionTextColor, setCaptionTextColor] = useState("#ffffff");
  const [captionBackground, setCaptionBackground] = useState<"none" | "pill" | "bar">("pill");
  /** "full" = whole line; "wordByWord" = build up with highlight; "singleWord" = only current word on screen */
  const [captionDisplayMode, setCaptionDisplayMode] = useState<"full" | "wordByWord" | "singleWord">("full");

  /** Transition between scenes (preview + server export). */
  type SceneTransitionType = "fade" | "slideLeft" | "slideRight" | "wipe" | "zoom" | "pushUp" | "pushDown" | "blur" | "spin" | "flip";
  const [sceneTransitionType, setSceneTransitionType] = useState<SceneTransitionType>("fade");

  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [musicVolume, setMusicVolume] = useState(70);

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [activeScene, setActiveScene] = useState<{ scene: SceneBlock; index: number } | null>(null);
  const [activeCaption, setActiveCaption] = useState<CaptionBlock | null>(null);
  const [selectedCaptionId, setSelectedCaptionId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<VideoTemplate | null>(null);
  const [aspectRatio, setAspectRatio] = useState<string>("9:16");
  const [showCustomize, setShowCustomize] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<VideoTemplate | null>(null);
  const [customDuration, setCustomDuration] = useState(30);
  const [customSceneCount, setCustomSceneCount] = useState(5);
  /** When set, show duration/scene modal for "Start from a template" grid (TEMPLATES). */
  const [pendingTemplatesKey, setPendingTemplatesKey] = useState<keyof typeof TEMPLATES | null>(null);

  /** Smart linking: prefill from planning pages (thumbnail, title, description, hashtags, scheduled date). */
  const [prefillThumbnailUrl, setPrefillThumbnailUrl] = useState<string | null>(null);
  const [prefillDescription, setPrefillDescription] = useState<string | null>(null);
  const [prefillHashtags, setPrefillHashtags] = useState<string | null>(null);
  const [prefillScheduledAt, setPrefillScheduledAt] = useState<string | null>(null);
  /** Local value for scene duration input so user can type e.g. 3.5, 7, 10; committed on blur. */
  const [editingDurationInput, setEditingDurationInput] = useState<string>("");

  /** Server-side FFmpeg compile (Phase 4): progress, download URL, error */
  const [compileLoading, setCompileLoading] = useState(false);
  const [compileDownloadUrl, setCompileDownloadUrl] = useState<string | null>(null);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [compileTestLoading, setCompileTestLoading] = useState(false);

  /** Generate subtitles from voiceover (Whisper transcription) */
  const [transcribeLoading, setTranscribeLoading] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);

  /** Timeline view: zoom (0.25–3), pan by drag, right panel collapsed by default */
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; scrollLeft: number } | null>(null);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [expandedSceneIndex, setExpandedSceneIndex] = useState<number | null>(null);
  const [scrollState, setScrollState] = useState({ scrollLeft: 0, scrollWidth: 1, clientWidth: 1 });

  const [leftPanelTab, setLeftPanelTab] = useState<"media" | "audio">("media");
  const [mediaLibrary, setMediaLibrary] = useState<Array<{ id: string; url: string; type: "image" | "video"; name: string }>>([]);
  const leftMediaInputRef = useRef<HTMLInputElement>(null);
  const leftAudioInputRef = useRef<HTMLInputElement>(null);
  const [stockQuery, setStockQuery] = useState("");
  const [stockPhotos, setStockPhotos] = useState<Array<{ id: string; url: string; thumb: string }>>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [autoFillLoading, setAutoFillLoading] = useState(false);
  /** Index of scene whose trailing transition badge popover is open (i.e. transition between scene[i] and scene[i+1]) */
  const [transitionBadgeOpen, setTransitionBadgeOpen] = useState<number | null>(null);
  const [transitionBadgePos, setTransitionBadgePos] = useState<{ x: number; y: number } | null>(null);

  const MAX_UNDO = 50;
  type UndoSnapshot = { scenes: Scene[]; captions: CaptionBlock[] };
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<UndoSnapshot[]>([]);

  const duration = useMemo(() => {
    const blocks = buildSceneBlocksFromScenes(scenes);
    if (blocks.length === 0) return 0;
    return Math.max(0, ...blocks.map((b) => b.endTime));
  }, [scenes]);
  const sceneBlocks = useMemo(() => buildSceneBlocksFromScenes(scenes), [scenes]);
  const hasPerClipAudio = useMemo(() => scenes.some((s) => !!s.audioUrl?.trim()), [scenes]);
  const activeBlockAndScene = useMemo(
    () => getActiveBlockAndScene(sceneBlocks, scenes, currentTime),
    [sceneBlocks, scenes, currentTime]
  );
  const playbackSrc =
    hasPerClipAudio && activeBlockAndScene?.scene?.audioUrl
      ? activeBlockAndScene.scene.audioUrl!
      : voiceoverUrl ?? "";
  const playbackStartOffset =
    hasPerClipAudio && activeBlockAndScene?.scene?.audioUrl ? activeBlockAndScene.block.startTime : 0;
  const playbackStartOffsetRef = useRef(0);

  useEffect(() => {
    playbackStartOffsetRef.current = playbackStartOffset;
    const el = audioRef.current;
    if (el && playbackSrc) {
      const target = Math.max(0, currentTime - playbackStartOffset);
      if (Math.abs(el.currentTime - target) > 0.15) el.currentTime = target;
    }
  }, [playbackSrc, playbackStartOffset, currentTime]);

  /** Remove blank gaps: scenes are always packed back-to-back from 0s (like "Remove gaps"). Shift captions only when they shared a leading offset with scenes. */
  useEffect(() => {
    if (scenes.length === 0) return;
    const blocksBefore = buildSceneBlocksFromScenes(scenes).sort((a, b) => a.startTime - b.startTime);
    const minStart = blocksBefore[0].startTime;
    const nextScenes = collapseAllSceneGapsToContiguous(scenes);
    if (nextScenes === scenes) return;
    if (minStart > 0.02) {
      const capMin = captions.length > 0 ? Math.min(...captions.map((c) => c.startTime)) : Infinity;
      if (capMin >= minStart - 0.05) {
        setCaptions((prev) =>
          prev.map((c) => ({
            ...c,
            startTime: Math.max(0, c.startTime - minStart),
            endTime: Math.max(0, c.endTime - minStart),
            wordTimings: c.wordTimings?.map((w) => ({
              ...w,
              start: w.start - minStart,
              end: w.end - minStart,
            })),
          }))
        );
      }
    }
    setScenes(nextScenes);
  }, [scenes, captions]);

  const selectedCaption = useMemo(
    () => captions.find((c) => c.id === selectedCaptionId) ?? null,
    [captions, selectedCaptionId]
  );

  const pushUndoSnapshot = useCallback(() => {
    setUndoStack((prev) => {
      const next = [...prev, { scenes: structuredClone(scenes), captions: structuredClone(captions) }];
      return next.slice(-MAX_UNDO);
    });
    setRedoStack([]);
  }, [scenes, captions]);

  const undo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const snapshot = prev[prev.length - 1];
      setRedoStack((r) => [...r, { scenes: structuredClone(scenes), captions: structuredClone(captions) }]);
      setScenes(snapshot.scenes);
      setCaptions(snapshot.captions);
      return prev.slice(0, -1);
    });
  }, [scenes, captions]);

  const redo = useCallback(() => {
    setRedoStack((r) => {
      if (r.length === 0) return r;
      const snapshot = r[r.length - 1];
      setUndoStack((u) => [...u, { scenes: structuredClone(scenes), captions: structuredClone(captions) }]);
      setScenes(snapshot.scenes);
      setCaptions(snapshot.captions);
      return r.slice(0, -1);
    });
  }, [scenes, captions]);

  const sidebar = useSidebar();
  const sceneVideoRef = useRef<HTMLVideoElement>(null);
  const nextSceneVideoRef = useRef<HTMLVideoElement>(null);
  const playbackTailRef = useRef<{ rafId: number; timelineEnd: number; lastTs: number; lastUpdateTs: number; tailTime: number } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const imageUploadTargetRef = useRef<{ sceneIndex: number; elementIndex: number } | null>(null);
  const sceneElementFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsBrowser(typeof window !== "undefined");
  }, []);

  /** Load ffmpeg with a static worker (see postinstall copy to /public/ffmpeg-wasm/). */
  const initBrowserFFmpeg = useCallback(async () => {
    setFfmpegLoadError(null);
    try {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { fetchFile } = await import("@ffmpeg/util");
      const ffmpeg = new FFmpeg();
      ffmpeg.on("log", ({ message }) => {
        console.log("[ffmpeg]", message);
      });
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const classWorkerURL = `${origin}${FFMPEG_WORKER_PUBLIC_PATH}`;
      const coreURL = `${origin}${FFMPEG_CORE_PUBLIC_PATH}/ffmpeg-core.js`;
      const wasmURL = `${origin}${FFMPEG_CORE_PUBLIC_PATH}/ffmpeg-core.wasm`;

      const head = await fetch(coreURL, { method: "HEAD" }).catch(() => null);
      if (!head?.ok) {
        throw new Error(
          "Missing ffmpeg assets under /ffmpeg-core. Run: npm install (postinstall copies files)."
        );
      }

      await ffmpeg.load({ classWorkerURL, coreURL, wasmURL });
      ffmpegRef.current = ffmpeg;
      fetchFileRef.current = fetchFile;
      setFfmpegLoaded(true);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : typeof e === "string" ? e : "Failed to load video engine";
      console.error("[ffmpeg] init failed:", e);
      ffmpegRef.current = null;
      fetchFileRef.current = null;
      setFfmpegLoaded(false);
      setFfmpegLoadError(message);
    }
  }, []);

  useEffect(() => {
    if (!isBrowser) return;
    void initBrowserFFmpeg();
  }, [isBrowser, initBrowserFFmpeg]);

  // Keep music volume in sync
  useEffect(() => {
    const el = musicRef.current;
    if (el) el.volume = Math.max(0, Math.min(1, musicVolume / 100));
  }, [musicVolume, musicUrl]);

  // Update active scene when playhead or scene blocks change
  useEffect(() => {
    setActiveScene(getActiveScene(currentTime, sceneBlocks));
  }, [currentTime, sceneBlocks]);

  // Update active caption when playhead or captions change
  useEffect(() => {
    setActiveCaption(getActiveCaption(currentTime, captions));
  }, [currentTime, captions]);


  // Sync scene video position and play state with timeline
  const activeSceneIndexInScenes = activeScene != null ? scenes.findIndex((s) => s.id === activeScene.scene.id) : -1;
  useEffect(() => {
    const video = sceneVideoRef.current;
    if (!video || !activeScene) return;
    const scene = activeSceneIndexInScenes >= 0 ? scenes[activeSceneIndexInScenes] : null;
    const media = scene ? getSceneBackgroundMedia(scene) : null;
    if (media?.type !== "video") return;
    const sceneStart = activeScene.scene.startTime;
    const sceneDuration = activeScene.scene.endTime - sceneStart;
    const localTime = Math.max(0, Math.min(currentTime - sceneStart, sceneDuration));
    if (Math.abs(video.currentTime - localTime) > 0.3) video.currentTime = localTime;
    if (isPlaying && video.paused) video.play().catch(() => {});
    if (!isPlaying && !video.paused) video.pause();
  }, [currentTime, activeScene, activeSceneIndexInScenes, scenes, isPlaying]);

  // Preload and start next scene video during transition so crossfade has no black
  useEffect(() => {
    if (!activeScene || !sceneBlocks.length) return;
    const sortedBlocks = [...sceneBlocks].sort((a, b) => a.startTime - b.startTime);
    const currentIdx = sortedBlocks.findIndex((b) => b.id === activeScene.scene.id);
    const nextBlock = currentIdx >= 0 && currentIdx < sortedBlocks.length - 1 ? sortedBlocks[currentIdx + 1] : null;
    const PREVIEW_XFADE = 0.25;
    const PREVIEW_NEXT_MOUNT_LEAD = 0.5;
    const xfadeStart = activeScene.scene.endTime - PREVIEW_XFADE;
    const inNextLayerMountZone =
      nextBlock && currentTime >= xfadeStart - PREVIEW_NEXT_MOUNT_LEAD && currentTime < activeScene.scene.endTime;
    const inTransitionZone = nextBlock && currentTime >= xfadeStart && currentTime < activeScene.scene.endTime;
    if (!inNextLayerMountZone || !nextBlock) return;
    const nextSceneData = scenes.find((s) => s.id === nextBlock.id);
    const nextMedia = nextSceneData ? getSceneBackgroundMedia(nextSceneData) : null;
    if (nextMedia?.type !== "video") return;
    const nextVideo = nextSceneVideoRef.current;
    if (!nextVideo) return;
    if (Math.abs(nextVideo.currentTime) > 0.05) nextVideo.currentTime = 0;
    // Only decode/play during the visible crossfade so we are not running two videos for the whole lead window
    if (isPlaying && inTransitionZone && nextVideo.readyState >= 2 && nextVideo.paused) {
      nextVideo.play().catch(() => {});
    }
    if ((!isPlaying || !inTransitionZone) && !nextVideo.paused) nextVideo.pause();
  }, [currentTime, activeScene, sceneBlocks, scenes, isPlaying]);

  // Clear selection if it becomes invalid (e.g. after script change)
  useEffect(() => {
    if (selectedSceneIndex !== null && (selectedSceneIndex < 0 || selectedSceneIndex >= scenes.length)) {
      setSelectedSceneIndex(null);
    }
  }, [selectedSceneIndex, scenes.length]);

  // Clean up playback tail animation on unmount
  useEffect(() => {
    return () => {
      const r = playbackTailRef.current;
      if (r?.rafId) cancelAnimationFrame(r.rafId);
      playbackTailRef.current = null;
    };
  }, []);

  // Prevent outer browser scrollbar on this page only; restore on unmount
  useEffect(() => {
    const html = document.documentElement;
    const prevHtmlOverflow = html.style.overflow;
    const prevHtmlOverflowX = html.style.overflowX;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyOverflowX = document.body.style.overflowX;
    html.style.overflow = "hidden";
    html.style.overflowX = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.overflowX = "hidden";
    return () => {
      html.style.overflow = prevHtmlOverflow;
      html.style.overflowX = prevHtmlOverflowX;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.overflowX = prevBodyOverflowX;
    };
  }, []);

  // List scripts for dropdown (library + saved from Coach)
  useEffect(() => {
    let cancelled = false;
    fetch("/api/library?type=scripts")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: LibraryResponse) => {
        if (cancelled) return;
        const list = (Array.isArray(data) ? data : []).filter((i) => i.type === "script") as LibraryScript[];
        setScripts(list);
      })
      .catch(() => {});
    fetch("/api/saved-scripts")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: { id: string; title: string }[]) => {
        if (cancelled) return;
        setSavedScripts(Array.isArray(data) ? data : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // When scriptId is set, load script. Try library first so library scripts never 404 (then fall back to saved_scripts).
  // When projectId is in URL, skip so we don't overwrite project's scenes with script's (loadProject handles state).
  useEffect(() => {
    if (!scriptId) {
      skipLibraryTimelineHydrationForScriptId = null;
      setScriptName("");
      setVoiceoverUrl(null);
      setVoiceoverFileName(null);
      setVoiceoverDuration(0);
      setCaptions([]);
      setScenes([]);
      setSelectedSceneIndex(null);
      return;
    }
    if (searchParams.get("projectId")) return;
    /** Read lock inside fetch `.then` (not here): prefill effect runs after this effect starts and sets the lock before the response returns. */
    const shouldSkipReplacingScenesFromScriptLoad = () =>
      skipLibraryTimelineHydrationForScriptId != null && skipLibraryTimelineHydrationForScriptId === scriptId;
    let cancelled = false;

    const loadSavedScript = () =>
      fetch(`/api/saved-scripts/${scriptId}`)
        .then((r) => {
          if (!r.ok) throw new Error("Not found");
          return r.json();
        })
        .then((row: {
            title?: string;
            scenes_json?: Array<{
              scene_number: number;
              duration: number;
              script_text: string;
              image_url?: string | null;
              video_url?: string | null;
              caption?: string | null;
              animation_type?: string | null;
              section_label?: string | null;
              voiceover_url?: string | null;
            }>;
            voiceover_url?: string | null;
          }) => {
          if (cancelled) return;
          setScriptName(typeof row.title === "string" ? row.title : "");
          const scenesJson = Array.isArray(row.scenes_json) ? row.scenes_json : [];
          const singleVoiceUrl = typeof row.voiceover_url === "string" && row.voiceover_url.trim() ? row.voiceover_url.trim() : null;
          const hasPerSceneVoice = scenesJson.every(
            (s: { voiceover_url?: string | null }) => typeof s.voiceover_url === "string" && (s.voiceover_url as string).trim().startsWith("http")
          );
          setVoiceoverUrl(hasPerSceneVoice && !singleVoiceUrl ? null : singleVoiceUrl);
          setVoiceoverFileName(null);
          let totalDur = 0;
          let runStart = 0;
          const sceneList = scenesJson.map((s: { duration?: number; script_text?: string; image_url?: string | null; video_url?: string | null; animation_type?: string | null; section_label?: string | null; voiceover_url?: string | null }, i: number) => {
            const dur = typeof s.duration === "number" && s.duration > 0 ? s.duration : 5;
            totalDur += dur;
            const title = typeof s.section_label === "string" && s.section_label.trim()
              ? s.section_label.trim().slice(0, 80)
              : typeof s.script_text === "string"
                ? s.script_text.slice(0, 80)
                : `Scene ${i + 1}`;
            const imageUrl = typeof s.image_url === "string" && s.image_url.trim() ? s.image_url.trim() : null;
            const videoUrl = typeof s.video_url === "string" && s.video_url.trim() ? s.video_url.trim() : null;
            const animationType = typeof s.animation_type === "string" && s.animation_type.trim() ? s.animation_type.trim() : null;
            const voiceUrl =
              typeof s.voiceover_url === "string" && s.voiceover_url.trim().startsWith("http")
                ? s.voiceover_url.trim()
                : null;
            const scene = createSceneWithBackground(
              `scene_${i + 1}`,
              title,
              dur,
              SCENE_COLORS[i % SCENE_COLORS.length],
              imageUrl,
              videoUrl,
              animationType,
              runStart,
              voiceUrl
            );
            runStart += dur;
            return scene;
          });
          if (!shouldSkipReplacingScenesFromScriptLoad()) {
            setVoiceoverDuration(totalDur);
            setScenes(sceneList);
            let start = 0;
            const caps: CaptionBlock[] = scenesJson.map((s, i) => {
              const dur = typeof s.duration === "number" && s.duration > 0 ? s.duration : 5;
              /** Prefer script_text (full dialogue); legacy caption rows were sometimes truncated. */
              const text =
                (typeof s.script_text === "string" && s.script_text.trim() && s.script_text) ||
                (typeof s.caption === "string" ? s.caption : "") ||
                "";
              const block: CaptionBlock = { id: `cap-${i}`, text: text.trim(), startTime: start, endTime: start + dur };
              start += dur;
              return block;
            });
            setCaptions(caps);
            setSelectedSceneIndex(null);
            const sceneCountFromScript = sceneList.length;
            if (scriptId && typeof window !== "undefined" && sceneCountFromScript > 0) {
              try {
                const raw = localStorage.getItem(`cf-video-timeline-draft-${scriptId}`);
                if (raw) {
                  const draft = JSON.parse(raw) as { scriptId?: string; scenes?: unknown[]; captions?: unknown[]; voiceoverUrl?: string | null; musicUrl?: string | null; musicVolume?: number; captionPosition?: string; captionFontSize?: string; captionTextColor?: string; captionAnimation?: string; captionBackground?: string; captionDisplayMode?: string; sceneTransition?: string; aspectRatio?: string; voiceoverDuration?: number; scriptName?: string };
                  const draftSceneCount = Array.isArray(draft.scenes) ? draft.scenes.length : 0;
                  if (draft?.scriptId === scriptId && draftSceneCount >= sceneCountFromScript) {
                    const draftScenes = draft.scenes as Scene[];
                    const totalDuration = typeof draft.voiceoverDuration === "number" && draft.voiceoverDuration > 0 ? draft.voiceoverDuration : 0;
                    const draftSceneTotal = draftScenes.reduce((sum, s) => sum + (typeof s.duration === "number" ? s.duration : 0), 0);
                    const needNormalize = totalDuration > 0 && draftScenes.length >= 2 && draftSceneTotal < totalDuration * 0.9;
                    const scenesToSet = needNormalize
                      ? draftScenes.map((s, i) => ({
                          ...s,
                          startTime: i * (totalDuration / draftScenes.length),
                          duration: totalDuration / draftScenes.length,
                        }))
                      : draftScenes;
                    setScenes(scenesToSet);
                    if (Array.isArray(draft.captions)) {
                      setCaptions(
                        draft.captions.map((c: { id?: string; text?: string; startTime?: number; endTime?: number; wordTimings?: WordTiming[] }, i: number) => ({
                          id: typeof c.id === "string" ? c.id : `cap-${i}`,
                          text: typeof c.text === "string" ? c.text : "",
                          startTime: typeof c.startTime === "number" ? c.startTime : 0,
                          endTime: typeof c.endTime === "number" ? c.endTime : 0,
                          wordTimings: Array.isArray(c.wordTimings)
                            ? c.wordTimings.filter(
                                (w): w is WordTiming =>
                                  typeof w?.word === "string" && typeof w?.start === "number" && typeof w?.end === "number"
                              )
                            : undefined,
                        }))
                      );
                    }
                    if (typeof draft.voiceoverUrl === "string" && draft.voiceoverUrl.startsWith("http")) setVoiceoverUrl(draft.voiceoverUrl);
                    if (typeof draft.musicUrl === "string" && draft.musicUrl.startsWith("http")) setMusicUrl(draft.musicUrl);
                    if (typeof draft.musicVolume === "number") setMusicVolume(draft.musicVolume);
                    if (draft.captionPosition === "top" || draft.captionPosition === "middle" || draft.captionPosition === "bottom") setCaptionPosition(draft.captionPosition);
                    if (draft.captionFontSize === "small" || draft.captionFontSize === "medium" || draft.captionFontSize === "large") setCaptionFontSize(draft.captionFontSize);
                    if (typeof draft.captionTextColor === "string") setCaptionTextColor(draft.captionTextColor);
                    if (draft.captionAnimation === "none" || draft.captionAnimation === "fadeIn" || draft.captionAnimation === "slideUp" || draft.captionAnimation === "pop") setCaptionAnimation(draft.captionAnimation);
                    if (draft.captionBackground === "none" || draft.captionBackground === "pill" || draft.captionBackground === "bar") setCaptionBackground(draft.captionBackground);
                    if (draft.captionDisplayMode === "full" || draft.captionDisplayMode === "wordByWord" || draft.captionDisplayMode === "singleWord") setCaptionDisplayMode(draft.captionDisplayMode);
                    if (["fade","slideLeft","slideRight","wipe","zoom","pushUp","pushDown","blur","spin","flip"].includes(draft.sceneTransition)) setSceneTransitionType(draft.sceneTransition as SceneTransitionType);
                    if (typeof draft.aspectRatio === "string") setAspectRatio(draft.aspectRatio);
                    if (typeof draft.voiceoverDuration === "number" && draft.voiceoverDuration > 0) setVoiceoverDuration(draft.voiceoverDuration);
                    if (typeof draft.scriptName === "string" && draft.scriptName.trim()) setScriptName(draft.scriptName.trim());
                  }
                }
              } catch {
                // ignore
              }
            }
          }
        });

    const loadLibraryScript = () =>
      fetch(`/api/library/scripts/${scriptId}`)
        .then((r) => {
          if (!r.ok) throw new Error(`Script not found (${r.status})`);
          return r.json();
        })
        .then(async (row: { title?: string; content?: unknown }) => {
          if (cancelled) return;
          const content = parseContent(row.content);
          let url = getVoiceoverUrl(content);
          const sceneUrls = content.timelineSceneVoiceoverUrls ?? content.sceneVoiceovers;
          const validSceneUrls = Array.isArray(sceneUrls)
            ? (sceneUrls as string[]).filter((u) => typeof u === "string" && u.trim().startsWith("http"))
            : [];
          if (validSceneUrls.length > 1) {
            try {
              const concatRes = await fetch("/api/video-timeline/concat-voiceover", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ urls: validSceneUrls }),
              });
              if (concatRes.ok) {
                const data = (await concatRes.json()) as { url?: string };
                url = typeof data.url === "string" && data.url.trim() ? data.url.trim() : url;
              }
            } catch {
              url = url ?? validSceneUrls[0]?.trim() ?? null;
            }
          } else if (validSceneUrls.length === 1 && !url) {
            url = validSceneUrls[0].trim();
          }
          setScriptName(typeof row.title === "string" ? row.title : "");
          setVoiceoverUrl(url);
          setVoiceoverFileName(null);
          const dur = typeof content.timelineVoiceoverDuration === "number" ? content.timelineVoiceoverDuration : 0;
          const caps = getCaptions(content);
          const fullTexts = getSceneFullTexts(content);
          if (!shouldSkipReplacingScenesFromScriptLoad()) {
            setVoiceoverDuration(dur);
            setCaptions(caps);
            const perSceneDuration = fullTexts.length > 0 && dur > 0 ? dur / fullTexts.length : 5;
            if (fullTexts.length > 0) {
              setScenes(
                fullTexts.map((title, i) =>
                  createScene(`scene_${i + 1}`, title, perSceneDuration, SCENE_COLORS[i % SCENE_COLORS.length])
                )
              );
            } else if (caps.length > 0) {
              const captionDuration = Math.max(dur, ...caps.map((c) => c.endTime).filter(Number.isFinite));
              const singleSceneDuration = captionDuration > 0 ? captionDuration : 5;
              setScenes([
                createScene("scene_1", caps[0]?.text?.slice(0, 50) || "Scene 1", singleSceneDuration, SCENE_COLORS[0]),
              ]);
              if (dur <= 0 && captionDuration > 0) setVoiceoverDuration(captionDuration);
            } else {
              setScenes([]);
            }
            setSelectedSceneIndex(null);
            // Restore draft only if it has at least as many scenes as the script (so 5-scene script isn't overwritten by a 3-scene draft)
            const sceneCountFromScript = fullTexts.length || (caps.length > 0 ? 1 : 0);
            if (scriptId && typeof window !== "undefined" && sceneCountFromScript > 0) {
              try {
                const raw = localStorage.getItem(`cf-video-timeline-draft-${scriptId}`);
                if (raw) {
                  const draft = JSON.parse(raw) as { scriptId?: string; scenes?: unknown[]; captions?: unknown[]; voiceoverUrl?: string | null; musicUrl?: string | null; musicVolume?: number; captionPosition?: string; captionFontSize?: string; captionTextColor?: string; captionAnimation?: string; captionBackground?: string; captionDisplayMode?: string; sceneTransition?: string; aspectRatio?: string; voiceoverDuration?: number; scriptName?: string };
                  const draftSceneCount = Array.isArray(draft.scenes) ? draft.scenes.length : 0;
                  if (draft?.scriptId === scriptId && draftSceneCount >= sceneCountFromScript) {
                    const draftScenes = draft.scenes as Scene[];
                    const totalDuration = typeof draft.voiceoverDuration === "number" && draft.voiceoverDuration > 0 ? draft.voiceoverDuration : 0;
                    const draftSceneTotal = draftScenes.reduce((sum, s) => sum + (typeof s.duration === "number" ? s.duration : 0), 0);
                    const needNormalize = totalDuration > 0 && draftScenes.length >= 2 && draftSceneTotal < totalDuration * 0.9;
                    const scenesToSet = needNormalize
                      ? draftScenes.map((s, i) => ({
                          ...s,
                          startTime: i * (totalDuration / draftScenes.length),
                          duration: totalDuration / draftScenes.length,
                        }))
                      : draftScenes;
                    setScenes(scenesToSet);
                    if (Array.isArray(draft.captions)) {
                      setCaptions(
                        draft.captions.map((c: { id?: string; text?: string; startTime?: number; endTime?: number; wordTimings?: WordTiming[] }, i: number) => ({
                          id: typeof c.id === "string" ? c.id : `cap-${i}`,
                          text: typeof c.text === "string" ? c.text : "",
                          startTime: typeof c.startTime === "number" ? c.startTime : 0,
                          endTime: typeof c.endTime === "number" ? c.endTime : 0,
                          wordTimings: Array.isArray(c.wordTimings)
                            ? c.wordTimings.filter(
                                (w): w is WordTiming =>
                                  typeof w?.word === "string" && typeof w?.start === "number" && typeof w?.end === "number"
                              )
                            : undefined,
                        }))
                      );
                    }
                    if (typeof draft.voiceoverUrl === "string" && draft.voiceoverUrl.startsWith("http")) setVoiceoverUrl(draft.voiceoverUrl);
                    if (typeof draft.musicUrl === "string" && draft.musicUrl.startsWith("http")) setMusicUrl(draft.musicUrl);
                    if (typeof draft.musicVolume === "number") setMusicVolume(draft.musicVolume);
                    if (draft.captionPosition === "top" || draft.captionPosition === "middle" || draft.captionPosition === "bottom") setCaptionPosition(draft.captionPosition);
                    if (draft.captionFontSize === "small" || draft.captionFontSize === "medium" || draft.captionFontSize === "large") setCaptionFontSize(draft.captionFontSize);
                    if (typeof draft.captionTextColor === "string") setCaptionTextColor(draft.captionTextColor);
                    if (draft.captionAnimation === "none" || draft.captionAnimation === "fadeIn" || draft.captionAnimation === "slideUp" || draft.captionAnimation === "pop") setCaptionAnimation(draft.captionAnimation);
                    if (draft.captionBackground === "none" || draft.captionBackground === "pill" || draft.captionBackground === "bar") setCaptionBackground(draft.captionBackground);
                    if (draft.captionDisplayMode === "full" || draft.captionDisplayMode === "wordByWord" || draft.captionDisplayMode === "singleWord") setCaptionDisplayMode(draft.captionDisplayMode);
                    if (["fade","slideLeft","slideRight","wipe","zoom","pushUp","pushDown","blur","spin","flip"].includes(draft.sceneTransition)) setSceneTransitionType(draft.sceneTransition as SceneTransitionType);
                    if (typeof draft.aspectRatio === "string") setAspectRatio(draft.aspectRatio);
                    if (typeof draft.voiceoverDuration === "number" && draft.voiceoverDuration > 0) setVoiceoverDuration(draft.voiceoverDuration);
                    if (typeof draft.scriptName === "string" && draft.scriptName.trim()) setScriptName(draft.scriptName.trim());
                  }
                }
              } catch {
                // ignore invalid draft
              }
            }
          }
        });

    const load = loadLibraryScript().catch(() => loadSavedScript());
    load.catch((err) => {
      if (process.env.NODE_ENV === "development") console.error("[video-timeline] Script load error:", scriptId, err);
      if (!cancelled) {
        setScriptName("");
        setVoiceoverUrl(null);
        setVoiceoverFileName(null);
        setVoiceoverDuration(0);
        setCaptions([]);
        setScenes([]);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [scriptId, searchParams]);

  // Sync initial scriptId from URL
  useEffect(() => {
    const id = searchParams.get("scriptId") ?? searchParams.get("libraryScriptId") ?? undefined;
    if (id) setScriptId(id);
  }, [searchParams]);

  // Smart linking: apply prefill from planning pages (Script Generator, Thumbnails, Copy Writer, SEO, Calendar, Campaign Mode)
  useEffect(() => {
    const fromSession = getVideoPrefill();
    const prefill = fromSession ?? videoTimelinePrefillStrictModeBackup;
    if (!prefill) {
      skipLibraryTimelineHydrationForScriptId = null;
      return;
    }
    if (fromSession) {
      videoTimelinePrefillStrictModeBackup = fromSession;
    }
    if (prefill.scriptId) setScriptId(prefill.scriptId);
    if (prefill.title?.trim()) setScriptName(prefill.title.trim());
    if (prefill.thumbnailUrl?.trim()) setPrefillThumbnailUrl(prefill.thumbnailUrl.trim());
    if (prefill.description !== undefined) setPrefillDescription(prefill.description || null);
    if (prefill.hashtags !== undefined) setPrefillHashtags(prefill.hashtags || null);
    if (prefill.scheduledAt !== undefined) setPrefillScheduledAt(prefill.scheduledAt || null);
    if (prefill.source === "campaign-mode" && prefill.timelineScenes?.length) {
      const campaignScenes: Scene[] = prefill.timelineScenes.map((s, i) =>
        createScene(
          `campaign-scene-${i}`,
          (s.visual ?? `Scene ${(s.scene_number ?? i) + 1}`).slice(0, 80),
          typeof s.duration_seconds === "number" ? s.duration_seconds : 5,
          SCENE_COLOR_HEX[i % SCENE_COLOR_HEX.length]
        )
      );
      setScenes(campaignScenes);
      setSelectedTemplate(VIDEO_TEMPLATES[4]);
    }
    if (prefill.source === "template-studio" && prefill.timelineScenes?.length) {
      const defaultDuration = 5;
      let runStart = 0;
      const templateScenes: Scene[] = prefill.timelineScenes.map((s, i) => {
        const duration = typeof s.duration_seconds === "number" ? s.duration_seconds : defaultDuration;
        const title = (s.captionText ?? s.visual ?? `Scene ${(s.scene_number ?? i) + 1}`).slice(0, 80);
        const scene = createSceneWithBackground(
          `template-scene-${i}`,
          title,
          duration,
          SCENE_COLOR_HEX[i % SCENE_COLOR_HEX.length],
          s.imageUrl ?? null,
          s.videoUrl ?? null,
          undefined,
          runStart,
          s.audioUrl ?? null
        );
        runStart += duration;
        return scene;
      });
      const captions: CaptionBlock[] = prefill.timelineScenes
        .map((s, i) => {
          const duration = typeof s.duration_seconds === "number" ? s.duration_seconds : defaultDuration;
          const startTime = prefill.timelineScenes!.slice(0, i).reduce((sum, x) => sum + (typeof x.duration_seconds === "number" ? x.duration_seconds : defaultDuration), 0);
          const text = s.captionText?.trim();
          if (!text) return null;
          return {
            id: `cap-template-${i}`,
            text,
            startTime,
            endTime: startTime + duration,
          };
        })
        .filter((c): c is CaptionBlock => c != null);
      setScenes(templateScenes);
      if (captions.length > 0) setCaptions(captions);
      const totalDuration = templateScenes.reduce((sum, sc) => sum + sc.duration, 0);
      if (totalDuration > 0) setVoiceoverDuration(totalDuration);
      setSelectedTemplate(VIDEO_TEMPLATES[4]);
      const lockSid =
        prefill.scriptId?.trim() ||
        (typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("libraryScriptId") ||
            new URLSearchParams(window.location.search).get("scriptId")
          : null)?.trim() ||
        null;
      if (lockSid) skipLibraryTimelineHydrationForScriptId = lockSid;
    }
    if (prefill.voiceoverText?.trim()) {
      try {
        navigator.clipboard.writeText(prefill.voiceoverText.trim());
      } catch {
        // ignore
      }
    }
    clearVideoPrefill();
    if (fromSession) {
      // Dev Strict Mode remount runs another effect pass before this macrotask; keep backup until then.
      // Single mount (prod): clear backup on the next tick so a later visit without prefill does not reuse stale data.
      window.setTimeout(() => {
        videoTimelinePrefillStrictModeBackup = null;
      }, 0);
    } else {
      videoTimelinePrefillStrictModeBackup = null;
    }
  }, []);

  // When scriptId or projectId is in URL, set a template so the timeline layout shows and script/project can load.
  const projectIdFromUrl = searchParams.get("projectId");
  const scriptIdFromUrl = searchParams.get("scriptId") ?? searchParams.get("libraryScriptId");
  useEffect(() => {
    if ((scriptIdFromUrl || projectIdFromUrl) && !selectedTemplate) setSelectedTemplate(VIDEO_TEMPLATES[4]);
  }, [scriptIdFromUrl, projectIdFromUrl, selectedTemplate]);

  // Load saved project and restore full timeline state (template, scenes, captions, media, style, etc.)
  const loadProject = useCallback(async (projectId: string) => {
    try {
      let res: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        res = await fetch(`/api/video-timeline/videos/${encodeURIComponent(projectId)}`, {
          cache: "no-store",
          credentials: "include",
        });
        if (res.ok) break;
        if (res.status === 401 && attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
          continue;
        }
        break;
      }
      if (!res || !res.ok) {
        const errData = await res?.json().catch(() => ({} as { error?: string }));
        throw new Error(typeof errData?.error === "string" ? errData.error : "Failed to load project");
      }
      const data = (await res.json()) as {
        metadata?: Record<string, unknown>;
        title?: string;
        scriptId?: string | null;
      };
      const meta = data.metadata ?? {};
      // Scenes (normalize so they fill total duration for normal video flow)
      const scenesList = Array.isArray(meta.scenes) ? meta.scenes : [];
      const totalDuration = typeof meta.totalDuration === "number" && meta.totalDuration > 0 ? meta.totalDuration : 0;
      let migratedCaptions: CaptionBlock[] | null = null;
      const sourceType = typeof meta.sourceType === "string" ? meta.sourceType : "";
      const legacyStickmanScenes = Array.isArray(meta.stickmanScenes) ? meta.stickmanScenes : [];
      const shouldForceStickmanRebuild = sourceType === "stickman-whiteboard" && legacyStickmanScenes.length > 0;
      if (shouldForceStickmanRebuild) {
        const migrated = buildTimelineFromStickmanMetadata(legacyStickmanScenes);
        if (migrated.scenes.length > 0) {
          setScenes(migrated.scenes.map(normalizeSceneClipAudioUrl));
          migratedCaptions = migrated.captions;
          if (migrated.totalDuration > 0) setVoiceoverDuration(migrated.totalDuration);
        }
      } else if (scenesList.length > 0) {
        const allRenderable = scenesList.every(isRenderableTimelineScene);
        if (allRenderable) {
          const list = (scenesList as Scene[]).map(normalizeSceneClipAudioUrl);
          const sceneTotal = list.reduce((sum, s) => sum + (typeof s.duration === "number" ? s.duration : 0), 0);
          const needNormalize = totalDuration > 0 && list.length >= 2 && sceneTotal < totalDuration * 0.9;
          const scenesToSet = needNormalize
            ? list.map((s, i) => ({
                ...s,
                startTime: i * (totalDuration / list.length),
                duration: totalDuration / list.length,
              }))
            : list;
          setScenes(scenesToSet);
        } else {
          const migratedFromScenes = migrateLegacyScenesList(scenesList);
          if (migratedFromScenes.scenes.length > 0) {
            setScenes(migratedFromScenes.scenes.map(normalizeSceneClipAudioUrl));
            migratedCaptions = migratedFromScenes.captions;
            if (migratedFromScenes.totalDuration > 0) setVoiceoverDuration(migratedFromScenes.totalDuration);
          }
        }
      } else {
        if (legacyStickmanScenes.length > 0) {
          const migrated = buildTimelineFromStickmanMetadata(legacyStickmanScenes);
          if (migrated.scenes.length > 0) {
            setScenes(migrated.scenes.map(normalizeSceneClipAudioUrl));
            migratedCaptions = migrated.captions;
            if (migrated.totalDuration > 0) setVoiceoverDuration(migrated.totalDuration);
          }
        }
      }
      // Captions
      const caps = Array.isArray(meta.captions) ? meta.captions : [];
      const parsedCaps = caps
        .map((c: { id?: string; text?: string; startTime?: number; endTime?: number; wordTimings?: WordTiming[] }, i: number) => ({
          id: typeof c.id === "string" ? c.id : `cap-${i}`,
          text: typeof c.text === "string" ? c.text : "",
          startTime: typeof c.startTime === "number" ? c.startTime : 0,
          endTime: typeof c.endTime === "number" ? c.endTime : 0,
          wordTimings: Array.isArray(c.wordTimings)
            ? c.wordTimings.filter(
                (w): w is WordTiming =>
                  typeof w?.word === "string" && typeof w?.start === "number" && typeof w?.end === "number"
              )
            : undefined,
        }))
        .filter((c) => c.text.trim() && c.endTime > c.startTime);
      if (parsedCaps.length > 0) {
        setCaptions(
          parsedCaps
        );
      } else if (migratedCaptions && migratedCaptions.length > 0) {
        setCaptions(migratedCaptions);
      }
      if (typeof meta.voiceoverUrl === "string") setVoiceoverUrl(meta.voiceoverUrl);
      if (typeof meta.musicUrl === "string") setMusicUrl(meta.musicUrl);
      if (typeof meta.musicVolume === "number") setMusicVolume(meta.musicVolume);
      if (typeof meta.totalDuration === "number") setVoiceoverDuration(meta.totalDuration);
      if (sourceType === "stickman-whiteboard") {
        setAspectRatio("16:9");
      }
      const style = meta.captionStyle && typeof meta.captionStyle === "object" ? (meta.captionStyle as Record<string, unknown>) : {};
      if (style.position === "top" || style.position === "middle" || style.position === "bottom") setCaptionPosition(style.position as "top" | "middle" | "bottom");
      if (style.fontSize === "small" || style.fontSize === "medium" || style.fontSize === "large") setCaptionFontSize(style.fontSize as "small" | "medium" | "large");
      if (typeof style.textColor === "string") setCaptionTextColor(style.textColor);
      if (style.animation === "none" || style.animation === "fadeIn" || style.animation === "slideUp" || style.animation === "pop") setCaptionAnimation(style.animation as "none" | "fadeIn" | "slideUp" | "pop");
      if (style.background === "none" || style.background === "pill" || style.background === "bar") setCaptionBackground(style.background);
      if (style.displayMode === "full" || style.displayMode === "wordByWord" || style.displayMode === "singleWord") setCaptionDisplayMode(style.displayMode);
      const transition = meta.sceneTransition;
      if (["fade","slideLeft","slideRight","wipe","zoom","pushUp","pushDown","blur","spin","flip"].includes(transition)) setSceneTransitionType(transition as SceneTransitionType);
      if (typeof meta.aspectRatio === "string" && sourceType !== "stickman-whiteboard") setAspectRatio(meta.aspectRatio);
      const t = meta.template;
      if (t != null && typeof t === "object" && "id" in t) {
        const full = VIDEO_TEMPLATES.find((tm) => tm.id === (t as { id: string }).id);
        setSelectedTemplate(full ?? (t as VideoTemplate));
      }
      if (data.scriptId != null) setScriptId(data.scriptId ?? undefined);
      if (typeof data.title === "string" && data.title.trim()) setScriptName(data.title.trim());
    } catch (err) {
      console.error("Load project failed:", err);
      alert(err instanceof Error ? err.message : "Failed to load project");
    }
  }, []);

  // On timeline page mount (and when projectId in URL changes), load the saved project
  useEffect(() => {
    if (projectIdFromUrl) loadProject(projectIdFromUrl);
  }, [projectIdFromUrl, loadProject]);

  const prevSceneCountRef = useRef<number>(0);
  const saveDraft = useCallback(() => {
    if (!scriptId || projectIdFromUrl || typeof window === "undefined") return;
    try {
      const payload = {
        scriptId,
        scriptName: scriptName?.trim() || "",
        scenes,
        captions,
        voiceoverUrl: voiceoverUrl && (voiceoverUrl.startsWith("http") ? voiceoverUrl : null),
        musicUrl: musicUrl && (musicUrl.startsWith("http") ? musicUrl : null),
        musicVolume,
        captionPosition,
        captionFontSize,
        captionTextColor,
        captionAnimation,
        captionBackground,
        captionDisplayMode,
        sceneTransition: sceneTransitionType,
        aspectRatio,
        voiceoverDuration: voiceoverDuration > 0 ? voiceoverDuration : undefined,
        savedAt: Date.now(),
      };
      localStorage.setItem(`cf-video-timeline-draft-${scriptId}`, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, [scriptId, projectIdFromUrl, scriptName, scenes, captions, voiceoverUrl, musicUrl, musicVolume, captionPosition, captionFontSize, captionTextColor, captionAnimation, captionBackground, captionDisplayMode, sceneTransitionType, aspectRatio, voiceoverDuration]);

  // When scene count changes (add/remove), save draft immediately so scenes don't disappear on refresh
  useEffect(() => {
    if (scenes.length !== prevSceneCountRef.current) {
      prevSceneCountRef.current = scenes.length;
      saveDraft();
    }
  }, [scenes.length, scenes, saveDraft]);

  // Persist draft to localStorage so refresh doesn't lose progress (debounced)
  useEffect(() => {
    if (!scriptId || projectIdFromUrl || typeof window === "undefined") return;
    const t = setTimeout(saveDraft, 1500);
    return () => clearTimeout(t);
  }, [scriptId, projectIdFromUrl, scriptName, scenes, captions, voiceoverUrl, musicUrl, musicVolume, captionPosition, captionFontSize, captionTextColor, captionAnimation, captionBackground, captionDisplayMode, sceneTransitionType, aspectRatio, voiceoverDuration, saveDraft]);

  // Audio events: time update, duration, play/pause
  const onTimeUpdate = useCallback(() => {
    const el = audioRef.current;
    if (!el || isDraggingPlayhead) return;
    const offset = playbackStartOffsetRef.current ?? 0;
    const newTime = offset + el.currentTime;
    setCurrentTime(newTime);
    const caption = getActiveCaption(newTime, captions);
    setActiveCaption(caption);
  }, [isDraggingPlayhead, captions]);

  const onDurationChange = useCallback(() => {
    const el = audioRef.current;
    if (el && Number.isFinite(el.duration)) setVoiceoverDuration(el.duration);
  }, []);

  const onPlay = useCallback(() => setIsPlaying(true), []);
  const onPause = useCallback(() => setIsPlaying(false), []);

  const play = useCallback(() => {
    const voice = audioRef.current;
    const music = musicRef.current;
    if (voice && music) music.currentTime = voice.currentTime;
    voice?.play();
    music?.play();
    sceneVideoRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    musicRef.current?.pause();
    sceneVideoRef.current?.pause();
    setIsPlaying(false);
  }, []);

  /** Keyboard shortcuts: Space = play/pause, Cmd/Ctrl+Z = undo, Cmd/Ctrl+Shift+Z = redo */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (isPlaying) {
          pause();
        } else if (voiceoverUrl?.trim() || hasPerClipAudio) {
          play();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.metaKey || e.ctrlKey) && (e.key === "Z" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPlaying, play, pause, undo, redo, voiceoverUrl, hasPerClipAudio]);

  const onPlaybackEnded = useCallback(() => {
    const el = audioRef.current;
    let voiceEnd = Number(el?.duration) ? el.duration : (voiceoverDuration > 0 ? voiceoverDuration : 0);
    let timelineEnd = Math.max(duration, voiceEnd);

    if (hasPerClipAudio && activeBlockAndScene?.scene?.audioUrl) {
      const blocksWithAudio = sceneBlocks
        .map((b) => ({ block: b, scene: scenes.find((s) => s.id === b.id) }))
        .filter((x): x is { block: SceneBlock; scene: Scene } => !!x.scene?.audioUrl?.trim())
        .sort((a, b) => a.block.startTime - b.block.startTime);
      const currentStart = activeBlockAndScene.block.startTime;
      const next = blocksWithAudio.find((x) => x.block.startTime > currentStart);
      if (next) {
        setCurrentTime(next.block.startTime);
        setActiveCaption(getActiveCaption(next.block.startTime, captions));
        const music = musicRef.current;
        if (music) music.currentTime = next.block.startTime;
        // Start next clip on next tick so the audio element has the new src from React
        setTimeout(() => play(), 0);
        return;
      }
      // No next clip with audio: continue playhead through rest of timeline (tail from end of current block)
      voiceEnd = activeBlockAndScene.block.endTime;
      timelineEnd = Math.max(duration, voiceEnd);
    }

    // Pause voice and music; scene video may keep playing if we run the tail
    audioRef.current?.pause();
    musicRef.current?.pause();
    if (musicRef.current && Number.isFinite(voiceEnd)) musicRef.current.currentTime = voiceEnd;

    const hasMoreTimeline = Number.isFinite(timelineEnd) && timelineEnd > voiceEnd + 0.05;
    if (hasMoreTimeline) {
      const TAIL_INTERVAL_MS = 100;
      const r = { rafId: 0, timelineEnd, lastTs: performance.now(), lastUpdateTs: performance.now(), tailTime: voiceEnd };
      playbackTailRef.current = r;
      const tick = () => {
        const ref = playbackTailRef.current;
        if (!ref || ref.rafId === 0) return;
        const now = performance.now();
        const delta = (now - ref.lastTs) / 1000;
        ref.lastTs = now;
        ref.tailTime = Math.min(ref.tailTime + delta, ref.timelineEnd);
        const shouldUpdate = now - ref.lastUpdateTs >= TAIL_INTERVAL_MS || ref.tailTime >= ref.timelineEnd;
        if (shouldUpdate) {
          ref.lastUpdateTs = now;
          if (ref.tailTime >= ref.timelineEnd) {
            ref.rafId = 0;
            playbackTailRef.current = null;
            sceneVideoRef.current?.pause();
            setIsPlaying(false);
            setCurrentTime(ref.timelineEnd);
            setActiveCaption(getActiveCaption(ref.timelineEnd, captions));
            return;
          }
          setCurrentTime(ref.tailTime);
        }
        ref.rafId = requestAnimationFrame(tick);
      };
      r.rafId = requestAnimationFrame(tick);
      return;
    }

    pause();
    const endTime = Number.isFinite(voiceEnd) && voiceEnd > 0 ? voiceEnd : duration;
    if (Number.isFinite(endTime) && endTime > 0) {
      setCurrentTime(endTime);
      setActiveCaption(getActiveCaption(endTime, captions));
    }
    setIsPlaying(false);
  }, [pause, voiceoverDuration, duration, captions, hasPerClipAudio, activeBlockAndScene, sceneBlocks, scenes, play]);

  const seekTo = useCallback(
    (t: number) => {
      const el = audioRef.current;
      const maxT = hasPerClipAudio ? duration : el?.duration ? el.duration : voiceoverDuration > 0 ? voiceoverDuration : duration;
      const clamped = Math.max(0, Math.min(t, maxT));
      const active = getActiveBlockAndScene(sceneBlocks, scenes, clamped);
      if (el) {
        const offset = hasPerClipAudio && active?.scene?.audioUrl ? active.block.startTime : 0;
        el.currentTime = Math.max(0, clamped - offset);
      }
      setCurrentTime(clamped);
      const caption = getActiveCaption(clamped, captions);
      setActiveCaption(caption);
      const music = musicRef.current;
      if (music) music.currentTime = clamped;
    },
    [duration, voiceoverDuration, captions, hasPerClipAudio, sceneBlocks, scenes]
  );

  // Timeline width: base width from duration, then zoom (0.25–3)
  const totalSceneDuration = duration;
  const effectiveDuration = voiceoverDuration > 0 ? voiceoverDuration : totalSceneDuration;
  const baseTimelineWidth =
    effectiveDuration > 0 ? Math.max(2000, effectiveDuration * PIXELS_PER_SECOND) : 2000;
  const timelineWidth = baseTimelineWidth * Math.max(0.25, Math.min(3, zoomLevel));
  const timeToX = (t: number) => (effectiveDuration > 0 ? (t / effectiveDuration) * timelineWidth : 0);
  const xToTime = (x: number) => (timelineWidth > 0 ? (x / timelineWidth) * effectiveDuration : 0);

  const handleZoomIn = useCallback(() => setZoomLevel((z) => Math.min(3, z * 1.25)), []);
  const handleZoomOut = useCallback(() => setZoomLevel((z) => Math.max(0.25, z / 1.25)), []);
  const handleFitToScreen = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el || baseTimelineWidth <= 0) return;
    const clientW = el.clientWidth - (el.querySelector(".shrink-0.w-24")?.clientWidth ?? 0);
    if (clientW > 0) setZoomLevel(clientW / baseTimelineWidth);
  }, [baseTimelineWidth]);

  const handleTimelineWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoomLevel((z) => Math.max(0.25, Math.min(3, e.deltaY > 0 ? z / 1.1 : z * 1.1)));
      }
    },
    []
  );

  const handleTimelinePanStart = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-playhead]") || (e.target as HTMLElement).closest("[data-sortable-scene]")) return;
    e.preventDefault();
    const el = scrollContainerRef.current;
    if (!el) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsPanning(true);
    panStartRef.current = { x: e.clientX, scrollLeft: el.scrollLeft };
  }, []);

  useEffect(() => {
    if (!isPanning || !panStartRef.current) return;
    const onMove = (e: PointerEvent) => {
      const el = scrollContainerRef.current;
      if (!el || !panStartRef.current) return;
      const dx = panStartRef.current.x - e.clientX;
      el.scrollLeft = panStartRef.current.scrollLeft + dx;
      panStartRef.current = { x: e.clientX, scrollLeft: el.scrollLeft };
    };
    const onUp = () => {
      setIsPanning(false);
      panStartRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [isPanning]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) setScrollState({ scrollLeft: el.scrollLeft, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth });
  }, [timelineWidth, zoomLevel]);

  // Playhead drag
  const handlePlayheadPointerDown = useCallback((e: React.PointerEvent) => {
    if (isExporting) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDraggingPlayhead(true);
  }, [isExporting]);

  useEffect(() => {
    if (!isDraggingPlayhead) return;
    const onMove = (e: PointerEvent) => {
      const tl = timelineRef.current;
      if (!tl) return;
      const rect = tl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const t = xToTime(x);
      seekTo(t);
    };
    const onUp = () => setIsDraggingPlayhead(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [isDraggingPlayhead, seekTo, timelineWidth, effectiveDuration]);

  // Timeline click to seek (skip when panning)
  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isExporting || isPanning) return;
      if ((e.target as HTMLElement).closest("[data-playhead]") || (e.target as HTMLElement).closest("[data-sortable-scene]")) return;
      const tl = timelineRef.current;
      if (!tl) return;
      const rect = tl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      seekTo(xToTime(x));
    },
    [seekTo, isExporting, isPanning]
  );

  const playheadX = timeToX(currentTime);

  // Scene media: file input and drag-drop
  const handleSceneMediaFile = useCallback(
    (file: File, sceneIndex: number) => {
      const type = file.type.startsWith("video/") ? "video" : "image";
      const url = URL.createObjectURL(file);
      setScenes((prev) => {
        const next = [...prev];
        if (sceneIndex < 0 || sceneIndex >= next.length) return prev;
        const scene = next[sceneIndex];
        const first = scene.elements[0];
        if (!first || !isBackgroundEl(first)) return prev;
        const oldUrl = first.media?.url;
        if (oldUrl) URL.revokeObjectURL(oldUrl);
        next[sceneIndex] = {
          ...scene,
          elements: [{ ...first, media: { url, type } }, ...scene.elements.slice(1)],
        };
        return next;
      });
    },
    []
  );

  const searchStockPhotos = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setStockLoading(true);
    try {
      const res = await fetch(`/api/stock-photos?query=${encodeURIComponent(query)}&per_page=12`);
      const data = await res.json() as { photos?: Array<{ id: string; url: string; thumb: string }> };
      setStockPhotos(data.photos ?? []);
    } catch {
      setStockPhotos([]);
    } finally {
      setStockLoading(false);
    }
  }, []);

  const autoFillScenes = useCallback(async () => {
    if (scenes.length === 0) return;
    setAutoFillLoading(true);
    // Extract a product/topic keyword from the script name (strip "Video Guide:", "Script:" prefixes)
    const productContext = scriptName
      .replace(/^(video guide|script|guide)\s*[:\-–]\s*/i, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40);
    try {
      const sceneBlocks = buildSceneBlocksFromScenes(scenes);
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        // Skip scenes that already have background media (e.g. product image)
        if (getSceneBackgroundMedia(scene) !== null) continue;
        // Use caption text that falls within this scene's time range
        const sceneBlock = sceneBlocks[i];
        const sceneCaptions = sceneBlock
          ? captions.filter((c) => c.startTime >= sceneBlock.startTime && c.startTime < sceneBlock.endTime)
          : [];
        const captionText = sceneCaptions.map((c) => c.text).join(" ").trim().slice(0, 80);
        // Build query: product context + caption snippet (or clean scene title)
        const cleanTitle = (scene.title ?? "")
          .replace(/^scene\s*\d+\s*[-–:]\s*/i, "")
          .trim();
        const query = productContext
          ? `${productContext} ${captionText || cleanTitle}`.trim().slice(0, 100)
          : captionText || cleanTitle || "lifestyle wellness";
        const res = await fetch(`/api/stock-photos?query=${encodeURIComponent(query)}&per_page=3`);
        const data = await res.json() as { photos?: Array<{ id: string; url: string; fullUrl?: string; thumb: string }> };
        const photo = data.photos?.[0];
        if (!photo) continue;
        const imgUrl = photo.url ?? photo.thumb;
        setScenes((prev) => prev.map((s, si) => {
          if (si !== i) return s;
          const first = s.elements[0];
          if (!first || !isBackgroundEl(first)) return s;
          return { ...s, elements: [{ ...first, media: { url: imgUrl, type: "image" as const } }, ...s.elements.slice(1)] };
        }));
        await new Promise((r) => setTimeout(r, 200));
      }
    } finally {
      setAutoFillLoading(false);
    }
  }, [scenes, scriptName, captions]);

  const selectedSceneDuration =
    selectedSceneIndex !== null && scenes[selectedSceneIndex]
      ? scenes[selectedSceneIndex].duration
      : null;

  // Keep duration input in sync when user selects a different scene
  useEffect(() => {
    if (selectedSceneDuration !== null) {
      setEditingDurationInput(String(selectedSceneDuration));
    } else {
      setEditingDurationInput("");
    }
  }, [selectedSceneIndex, selectedSceneDuration]);

  // Auto-split + auto-fill when arriving from TikTok Shop / video guide prefill
  const autoSplitTriggeredRef = useRef(false);
  const autoFillTriggeredRef = useRef(false);
  useEffect(() => {
    if (searchParams.get("videoGuidePrefill") !== "1") return;
    if (scenes.length === 0) return;

    // Step 1: If there is only 1 long scene, split it into ~5-second segments first.
    // This handles the case where the script has no content.scenes / content.scenePrompts
    // so only a single scene was created from captions.
    if (!autoSplitTriggeredRef.current) {
      const totalDur =
        voiceoverDuration > 0
          ? voiceoverDuration
          : scenes.reduce((sum, s) => sum + (s.duration ?? 0), 0);
      if (scenes.length === 1 && totalDur > 8) {
        autoSplitTriggeredRef.current = true;
        const targetCount = Math.max(3, Math.min(8, Math.round(totalDur / 5)));
        const segDur = totalDur / targetCount;
        const newScenes: Scene[] = Array.from({ length: targetCount }, (_, i) => {
          const segStart = i * segDur;
          const segEnd = segStart + segDur;
          const segCaps = captions.filter((c) => c.startTime >= segStart && c.startTime < segEnd);
          const title = segCaps.map((c) => c.text).join(" ").trim().slice(0, 50) || `Scene ${i + 1}`;
          if (i === 0) {
            // Preserve existing scene (may have product image as background)
            return { ...scenes[0], id: "scene_1", title, duration: segDur, startTime: 0 };
          }
          return createScene(`scene_${i + 1}`, title, segDur, SCENE_COLORS[i % SCENE_COLORS.length], segStart);
        });
        setScenes(newScenes);
        return; // Effect re-fires after setScenes with the new scene list
      }
      autoSplitTriggeredRef.current = true; // already multiple scenes, no split needed
    }

    // Step 2: Auto-fill empty scenes with stock photos.
    // Wait for captions so photo queries include caption text.
    if (captions.length === 0 && voiceoverUrl) return;
    const allHaveMedia = scenes.every((s) => getSceneBackgroundMedia(s) !== null);
    if (allHaveMedia) return;
    if (autoFillTriggeredRef.current) return;
    autoFillTriggeredRef.current = true;
    autoFillScenes();
  }, [scenes, captions, voiceoverUrl, voiceoverDuration, searchParams, autoFillScenes]);

  const addElementToScene = useCallback(
    (sceneIndex: number, kind: "text" | "image" | "graphic" | "sticker") => {
      const id = `el-${sceneIndex}-${Date.now()}`;
      const defaults: Record<typeof kind, SceneElement> = {
        text: { id, type: ELEMENT_TYPES.TEXT, content: "Hello", position: { x: 50, y: 20 }, fontSize: 24, color: "#ffffff" },
        image: { id, type: ELEMENT_TYPES.IMAGE, media: { url: "" }, position: { x: 10, y: 50 }, size: { w: 100, h: 100 } },
        graphic: { id, type: ELEMENT_TYPES.GRAPHIC, shape: "circle", color: "#ff0000", size: 80 },
        sticker: { id, type: ELEMENT_TYPES.STICKER, position: { x: 50, y: 50 }, size: 100 },
      };
      setScenes((prev) => {
        const next = [...prev];
        if (sceneIndex < 0 || sceneIndex >= next.length) return prev;
        next[sceneIndex] = {
          ...next[sceneIndex],
          elements: [...next[sceneIndex].elements, defaults[kind]],
        };
        return next;
      });
    },
    []
  );

  const updateSceneElement = useCallback(
    (sceneIndex: number, elementIndex: number, updates: Partial<SceneElement>) => {
      setScenes((prev) =>
        prev.map((scene, si) => {
          if (si !== sceneIndex) return scene;
          return {
            ...scene,
            elements: scene.elements.map((el, ei) =>
              ei === elementIndex ? { ...el, ...updates } : el
            ),
          };
        })
      );
    },
    []
  );

  const moveSceneElement = useCallback(
    (sceneIndex: number, fromIndex: number, direction: "front" | "back") => {
      setScenes((prev) => {
        const scene = prev[sceneIndex];
        if (!scene || fromIndex < 0 || fromIndex >= scene.elements.length) return prev;
        const minIndex = 1;
        const toIndex = direction === "front" ? scene.elements.length - 1 : minIndex;
        if (toIndex === fromIndex) return prev;
        const next = [...prev];
        const newElements = [...scene.elements];
        const [removed] = newElements.splice(fromIndex, 1);
        newElements.splice(toIndex, 0, removed);
        next[sceneIndex] = { ...scene, elements: newElements };
        return next;
      });
    },
    []
  );

  const removeSceneElement = useCallback((sceneIndex: number, elementIndex: number) => {
    const scene = scenes[sceneIndex];
    const first = scene?.elements[0];
    if (first && isBackgroundEl(first) && elementIndex === 0) return;
    setScenes((prev) => {
      const next = [...prev];
      if (sceneIndex < 0 || sceneIndex >= next.length) return prev;
      next[sceneIndex] = {
        ...next[sceneIndex],
        elements: next[sceneIndex].elements.filter((_, i) => i !== elementIndex),
      };
      return next;
    });
  }, [scenes]);

  const selectedScene = selectedSceneIndex !== null ? scenes[selectedSceneIndex] ?? null : null;

  const addElement = useCallback(
    (type: "text" | "image" | "graphic" | "sticker") => {
      if (!selectedScene) return;
      const id = `element_${Date.now()}`;
      const defaults: Record<typeof type, SceneElement> = {
        text: { id, type: "text", content: "New Text", fontSize: 24, color: "#ffffff", position: { x: 50, y: 50 } },
        image: { id, type: "image", media: { url: "" }, position: { x: 50, y: 50 }, size: { w: 100, h: 100 } },
        graphic: { id, type: "graphic", shape: "rectangle", color: "#3b82f6", size: 100 },
        sticker: { id, type: "sticker", position: { x: 50, y: 50 }, size: 100 },
      };
      const newElement = defaults[type];
      setScenes((prev) =>
        prev.map((scene) =>
          scene.id === selectedScene.id
            ? { ...scene, elements: [...scene.elements, newElement] }
            : scene
        )
      );
    },
    [selectedScene]
  );

  const removeElement = useCallback(
    (elementIndex: number) => {
      if (!selectedScene) return;
      setScenes((prev) =>
        prev.map((scene) =>
          scene.id === selectedScene.id
            ? { ...scene, elements: scene.elements.filter((_, i) => i !== elementIndex) }
            : scene
        )
      );
    },
    [selectedScene]
  );

  const updateElement = useCallback(
    (elementIndex: number, updates: Partial<SceneElement>) => {
      if (!selectedScene) return;
      setScenes((prev) =>
        prev.map((scene) =>
          scene.id === selectedScene.id
            ? {
                ...scene,
                elements: scene.elements.map((el, i) =>
                  i === elementIndex ? { ...el, ...updates } : el
                ),
              }
            : scene
        )
      );
    },
    [selectedScene]
  );

  const handleImageUpload = useCallback(
    (elementIndex: number, file: File | undefined) => {
      if (!selectedScene || !file) return;
      const el = selectedScene.elements[elementIndex];
      if (isImageEl(el)) {
        const prev = el.media?.url;
        if (prev) URL.revokeObjectURL(prev);
        updateElement(elementIndex, { media: { url: URL.createObjectURL(file) } });
      } else if (isStickerEl(el)) {
        const prev = el.media?.url;
        if (prev) URL.revokeObjectURL(prev);
        updateElement(elementIndex, { media: { url: URL.createObjectURL(file) } });
      }
    },
    [selectedScene, updateElement]
  );

  // Build payload for the videos table: title + content (stored in metadata by the API).
  const saveProjectPayload = useMemo(
    () => ({
      title: scriptName?.trim() || "Untitled Video",
      content: {
        scriptId: scriptId ?? undefined,
        template: selectedTemplate
          ? {
              id: selectedTemplate.id,
              name: selectedTemplate.name,
              aspectRatio: selectedTemplate.aspectRatio,
            }
          : null,
        scenes,
        captions,
        musicUrl: musicUrl ?? null,
        musicVolume,
        voiceoverUrl: voiceoverUrl ?? null,
        captionStyle: {
          position: captionPosition,
          fontSize: captionFontSize,
          textColor: captionTextColor,
          animation: captionAnimation,
          background: captionBackground,
          displayMode: captionDisplayMode,
        },
        sceneTransition: sceneTransitionType,
        aspectRatio,
        totalDuration: voiceoverDuration > 0 ? voiceoverDuration : duration,
      },
    }),
    [
      scriptName,
      scriptId,
      selectedTemplate,
      scenes,
      captions,
      musicUrl,
      musicVolume,
      voiceoverUrl,
      captionPosition,
      captionFontSize,
      captionTextColor,
      captionAnimation,
      captionBackground,
      captionDisplayMode,
      sceneTransitionType,
      aspectRatio,
      voiceoverDuration,
      duration,
    ]
  );

  /** Save timeline project to the existing videos table (via API; content stored in metadata). */
  const handleSaveToLibrary = useCallback(async (opts?: { silent?: boolean }) => {
    try {
      const videoProject = {
        title: saveProjectPayload.title,
        content: saveProjectPayload.content,
        ...(prefillThumbnailUrl && { thumbnailUrl: prefillThumbnailUrl }),
        ...(prefillDescription != null && { description: prefillDescription }),
        ...(prefillHashtags != null && { hashtags: prefillHashtags }),
        ...(prefillScheduledAt != null && { scheduledAt: prefillScheduledAt }),
      };
      const res = await fetch("/api/video-timeline/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(videoProject),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Save failed");
      const result = data as { id: string; title?: string; createdAt?: string };
      if (result.id && typeof window !== "undefined") {
        router.replace(`/dashboard/video-timeline?projectId=${encodeURIComponent(result.id)}`, { scroll: false });
        try {
          localStorage.removeItem(`cf-video-timeline-draft-${scriptId ?? ""}`);
        } catch {
          // ignore
        }
      }
      if (!opts?.silent) alert("✅ Saved to My Library!");
      return result;
    } catch (err) {
      console.error("Save failed:", err);
      if (!opts?.silent) alert("Failed to save: " + (err instanceof Error ? err.message : String(err)));
      throw err;
    }
  }, [saveProjectPayload, prefillThumbnailUrl, prefillDescription, prefillHashtags, prefillScheduledAt]);

  /** Save (if needed) and go to Content Calendar to schedule this video. */
  const handleSchedule = useCallback(async () => {
    const projectIdFromUrl = searchParams.get("projectId");
    try {
      const id =
        projectIdFromUrl ??
        (await handleSaveToLibrary({ silent: true }))?.id;
      if (id) router.push(`/dashboard/content-calendar?schedule=${encodeURIComponent(id)}`);
      else alert("Save the video first, then click Schedule.");
    } catch {
      alert("Save failed. Try saving to library first, then Schedule.");
    }
  }, [searchParams, handleSaveToLibrary, router]);

  const handleExportVideo = useCallback(async () => {
    const assets = collectSceneAssets(sceneBlocks, scenes, captions);
    const { valid, error } = validateSceneAssets(assets);
    if (!valid) {
      alert(error ?? "Export validation failed");
      return;
    }
    const hasPerClipAudio = assets.some(hasAssetAudioUrl);
    const looksLikeStickmanTimeline = scenes.some((s) => {
      const n = s as Scene & { pose?: string; shotTemplate?: string; keyObject?: string };
      return typeof n.pose === "string" || typeof n.shotTemplate === "string" || typeof n.keyObject === "string";
    });
    if (!voiceoverUrl?.trim() && !hasPerClipAudio && !looksLikeStickmanTimeline) {
      alert("No voiceover or per-clip audio to export. Add a voiceover or use scenes with audio.");
      return;
    }
    let savedVideoId: string | null = null;
    try {
      const saveResult = await handleSaveToLibrary({ silent: true });
      savedVideoId = saveResult?.id ?? null;
    } catch {
      alert("Save failed. Export aborted.");
      return;
    }
    setIsExporting(true);
    setExportProgress(0);
    try {
      const ffmpeg = ffmpegRef.current;
      const fetchFile = fetchFileRef.current;
      if (!ffmpeg || !fetchFile) {
        alert("Export not ready");
        setIsExporting(false);
        setExportProgress(0);
        return;
      }
      const data = await exportVideo({
        ffmpeg,
        fetchFile,
        voiceoverUrl: voiceoverUrl?.trim() || null,
        musicUrl,
        musicVolume,
        assets,
        captionStyle: {
          position: captionPosition,
          fontSize: captionFontSize,
          textColor: captionTextColor,
          animation: captionAnimation === "pop" ? "pop" : captionAnimation === "fadeIn" ? "fadeIn" : captionAnimation === "slideUp" ? "slideUp" : "none",
        },
        totalDuration: duration,
        onProgress: setExportProgress,
      });
      const blob = new Blob(
        [data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)],
        { type: "video/mp4" }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "content-flywheel-video.mp4";
      a.click();
      URL.revokeObjectURL(url);
      if (savedVideoId) {
        try {
          await fetch(`/api/video-timeline/videos/${savedVideoId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: "completed",
              metadata: {
                exportedAt: new Date().toISOString(),
                // Client-side exports are downloaded locally; no permanent remote URL exists.
                localExported: true,
              },
            }),
          });
        } catch (e) {
          console.warn("Failed to update video status after export:", e);
        }
      }
      try {
        await ffmpeg.deleteFile("voiceover.mp3");
      } catch {
        /* ignore */
      }
      const numClipAudios = assets.filter(hasAssetAudioUrl).length;
      for (let i = 0; i < numClipAudios; i++) {
        try {
          await ffmpeg.deleteFile(`clip_audio_${i}.mp3`);
        } catch {
          /* ignore */
        }
      }
      if (musicUrl) {
        try {
          await ffmpeg.deleteFile("music.mp3");
        } catch {
          /* ignore */
        }
      }
      let fileIndex = 0;
      for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];
        if (asset.type === "image") {
          try {
            await ffmpeg.deleteFile(`scene_${fileIndex}.png`);
          } catch {
            /* ignore */
          }
          fileIndex += 1;
        } else if (asset.type === "video") {
          try {
            await ffmpeg.deleteFile(`scene_${fileIndex}.mp4`);
          } catch {
            /* ignore */
          }
          fileIndex += 1;
        }
      }
      try {
        await ffmpeg.deleteFile("output.mp4");
      } catch {
        /* ignore */
      }
    } catch (err) {
      console.error("Export failed", err);
      alert(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  }, [
    sceneBlocks,
    scenes,
    captions,
    voiceoverUrl,
    musicUrl,
    musicVolume,
    captionPosition,
    captionFontSize,
    captionTextColor,
    captionAnimation,
    duration,
    handleSaveToLibrary,
  ]);

  /** Server-side compile: FFmpeg on API (Ken Burns, trim, xfade, voiceover) → Supabase → download URL */
  const handleExportVideoServer = useCallback(async () => {
    if (!scriptId?.trim()) {
      setCompileError("Load a script first (e.g. from AI Coach → Open in Video Timeline).");
      return;
    }
    setCompileLoading(true);
    setCompileError(null);
    setCompileDownloadUrl(null);
    try {
      const res = await fetch("/api/videos/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scriptId: scriptId.trim(), transition: sceneTransitionType }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? `Compile failed (${res.status})`);
      }
      if (data.url) {
        setCompileDownloadUrl(data.url);
        // Trigger immediate browser download so user does not need to hunt for links.
        const a = document.createElement("a");
        a.href = data.url;
        a.download = `${(scriptName || "content-flywheel-video").trim()}.mp4`;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.click();

        // Persist export URL on the saved timeline project so Library download always works.
        const currentProjectId = projectIdFromUrl ?? (await handleSaveToLibrary({ silent: true }))?.id ?? null;
        if (currentProjectId) {
          await fetch(`/api/video-timeline/videos/${encodeURIComponent(currentProjectId)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: "completed",
              metadata: {
                exportedAt: new Date().toISOString(),
                videoUrl: data.url,
                exportUrl: data.url,
                outputUrl: data.url,
                compiledVideoUrl: data.url,
              },
            }),
          }).catch(() => {});
        }
      } else {
        setCompileError("No download URL returned.");
      }
    } catch (err) {
      setCompileError(err instanceof Error ? err.message : "Compile failed");
    } finally {
      setCompileLoading(false);
    }
  }, [scriptId, sceneTransitionType, scriptName, projectIdFromUrl, handleSaveToLibrary]);

  // Optional: auto-export when navigated from Video Creation Guide after animations finish.
  // Uses voiceovers already present on the timeline scenes (per-clip audio) for template-studio flows.
  const autoExportStartedRef = useRef(false);
  useEffect(() => {
    const shouldAutoExport = searchParams.get("autoExport") === "1";
    if (!shouldAutoExport) return;
    if (autoExportStartedRef.current) return;
    if (scenes.length === 0) return;
    const looksLikeStickmanTimeline = scenes.some((s) => {
      const n = s as Scene & { pose?: string; shotTemplate?: string; keyObject?: string };
      return typeof n.pose === "string" || typeof n.shotTemplate === "string" || typeof n.keyObject === "string";
    });
    if (!hasPerClipAudio && !voiceoverUrl?.trim() && !looksLikeStickmanTimeline) return;
    if (scriptId?.trim()) {
      autoExportStartedRef.current = true;
      void handleExportVideoServer();
      return;
    }
    // Fallback: browser export (requires ffmpeg loaded). This path may still work without scriptId.
    if (!ffmpegLoaded) return;
    if (!ffmpegRef.current || !fetchFileRef.current) return;
    autoExportStartedRef.current = true;
    void handleExportVideo();
  }, [
    searchParams,
    scenes,
    scriptId,
    hasPerClipAudio,
    voiceoverUrl,
    ffmpegLoaded,
    handleExportVideoServer,
    handleExportVideo,
  ]);

  useEffect(() => {
    const shouldAutoClose = searchParams.get("autoClose") === "1";
    if (!shouldAutoClose) return;
    if (!compileDownloadUrl) return;
    const t = window.setTimeout(() => {
      window.close();
    }, 1200);
    return () => window.clearTimeout(t);
  }, [searchParams, compileDownloadUrl]);

  /** Test compile: creates 2-scene script, compiles, returns URL (no scriptId needed). */
  const handleTestCompile = useCallback(async () => {
    setCompileTestLoading(true);
    setCompileError(null);
    setCompileDownloadUrl(null);
    try {
      const res = await fetch("/api/videos/compile/test", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { url?: string; scriptId?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? `Test failed (${res.status})`);
      if (data.url) setCompileDownloadUrl(data.url);
      if (data.scriptId) setScriptId(data.scriptId);
    } catch (err) {
      setCompileError(err instanceof Error ? err.message : "Test compile failed");
    } finally {
      setCompileTestLoading(false);
    }
  }, []);

  const sceneSortableIds = useMemo(() => sceneBlocks.map((s) => s.id), [sceneBlocks]);
  const sceneSegmentWidthPx =
    sceneBlocks.length > 0 && timelineWidth > 0
      ? Math.max(SCENE_BLOCK_MIN_WIDTH, timelineWidth / sceneBlocks.length)
      : SCENE_BLOCK_MIN_WIDTH;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    })
  );

  const handleSceneDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = sceneBlocks.findIndex((s) => s.id === active.id);
      const newIndex = sceneBlocks.findIndex((s) => s.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      pushUndoSnapshot();
      setScenes((prev) => arrayMove(prev, oldIndex, newIndex));
      setSelectedSceneIndex(newIndex);
    },
    [sceneBlocks, pushUndoSnapshot]
  );

  const applyTemplate = useCallback((key: keyof typeof TEMPLATES) => {
    const t = TEMPLATES[key];
    let run = 0;
    const newScenes = Array.from({ length: t.sceneCount }, (_, i) => {
      const scene = createScene(`scene_${i + 1}`, `Scene ${i + 1}`, t.defaultSceneDuration, SCENE_COLORS[i % SCENE_COLORS.length], run);
      run += t.defaultSceneDuration;
      return scene;
    });
    setScenes(newScenes);
    setSelectedSceneIndex(null);
  }, []);

  /** Apply TEMPLATES key with custom duration/scene count (from "Start from a template" modal). */
  const applyTemplateWithCustom = useCallback(
    (key: keyof typeof TEMPLATES, totalDuration: number, sceneCount: number) => {
      const t = TEMPLATES[key];
      const sceneDuration = totalDuration / sceneCount;
      let run = 0;
      const newScenes = Array.from({ length: sceneCount }, (_, i) => {
        const scene = createScene(`scene_${i + 1}`, `Scene ${i + 1}`, sceneDuration, SCENE_COLORS[i % SCENE_COLORS.length], run);
        run += sceneDuration;
        return scene;
      });
      setScenes(newScenes);
      setSelectedSceneIndex(null);
      setAspectRatio(t.aspectRatio);
      setPendingTemplatesKey(null);
    },
    []
  );

  /** Add a new scene at the end of the timeline (default 5s). */
  const addScene = useCallback(() => {
    pushUndoSnapshot();
    const blocks = buildSceneBlocksFromScenes(scenes);
    const endOfLast = blocks.length > 0 ? Math.max(...blocks.map((b) => b.endTime)) : 0;
    const newScene = createScene(
      `scene_${Date.now()}`,
      `Scene ${scenes.length + 1}`,
      DEFAULT_NEW_SCENE_DURATION,
      SCENE_COLORS[scenes.length % SCENE_COLORS.length],
      endOfLast
    );
    setScenes((prev) => [...prev, newScene]);
    setSelectedSceneIndex(scenes.length);
  }, [scenes, pushUndoSnapshot]);

  /** Insert a new scene at the current playhead position (used from timeline). */
  const handleAddScene = useCallback(() => {
    pushUndoSnapshot();
    const startTime = Math.max(0, currentTime);
    const newScene = createScene(
      `scene_${Date.now()}`,
      `Scene ${scenes.length + 1}`,
      DEFAULT_NEW_SCENE_DURATION,
      SCENE_COLORS[scenes.length % SCENE_COLORS.length],
      startTime
    );
    setScenes((prev) => [...prev, newScene]);
    setSelectedSceneIndex(scenes.length);
  }, [currentTime, scenes.length, pushUndoSnapshot]);

  const deleteScene = useCallback((index: number) => {
    pushUndoSnapshot();
    setScenes((prev) => prev.filter((_, i) => i !== index));
    setSelectedSceneIndex((prev) => {
      if (prev === null) return null;
      if (prev === index) return null;
      if (prev > index) return prev - 1;
      return prev;
    });
  }, [pushUndoSnapshot]);

  /** Update a scene's duration (min 0.5s). Reorder via drag; click scene to edit duration in panel. */
  const updateSceneDuration = useCallback((sceneIndex: number, newDuration: number) => {
    pushUndoSnapshot();
    const sec = Math.max(0.5, Number.isFinite(newDuration) ? newDuration : 0.5);
    setScenes((prev) => {
      if (sceneIndex < 0 || sceneIndex >= prev.length) return prev;
      const next = [...prev];
      next[sceneIndex] = { ...next[sceneIndex], duration: sec };
      return next;
    });
  }, [pushUndoSnapshot]);

  /** Update scene start time and/or duration (for drag-to-reposition and edge resize). */
  const updateSceneTiming = useCallback((sceneId: string, updates: { startTime?: number; duration?: number }) => {
    setScenes((prev) => {
      const i = prev.findIndex((s) => s.id === sceneId);
      if (i < 0) return prev;
      const s = prev[i];
      const blocks = buildSceneBlocksFromScenes(prev);
      const currentBlock = blocks.find((b) => b.id === sceneId);
      const startTime = typeof updates.startTime === "number" ? Math.max(0, updates.startTime) : (currentBlock?.startTime ?? (typeof s.startTime === "number" ? s.startTime : 0));
      const duration = typeof updates.duration === "number" ? Math.max(0.5, updates.duration) : s.duration;
      return prev.map((sc) =>
        sc.id === sceneId ? { ...sc, startTime, duration } : sc
      );
    });
  }, []);

  /** Auto-sync scene blocks to voiceover: divide timeline into equal segments by scene count. */
  const handleAutoSyncToVoiceover = useCallback(() => {
    const total = voiceoverDuration > 0 ? voiceoverDuration : duration;
    if (total <= 0 || scenes.length === 0) return;
    const segDuration = total / scenes.length;
    setScenes((prev) =>
      prev.map((s, i) => ({ ...s, startTime: i * segDuration, duration: segDuration }))
    );
    setSelectedSceneIndex(null);
    setExpandedSceneIndex(null);
  }, [voiceoverDuration, duration, scenes.length]);

  /** When total duration (e.g. voiceover) is much longer than current scene blocks, auto-fill so video doesn't go blank after first scene. */
  const hasAutoFilledScenesRef = useRef(false);
  const lastProjectKeyRef = useRef<string>("");
  useEffect(() => {
    const key = `${projectIdFromUrl ?? ""}-${scriptId ?? ""}`;
    if (key !== lastProjectKeyRef.current) {
      lastProjectKeyRef.current = key;
      hasAutoFilledScenesRef.current = false;
    }
  }, [projectIdFromUrl, scriptId]);
  useEffect(() => {
    if (voiceoverDuration <= 0 || scenes.length < 2) return;
    if (duration >= voiceoverDuration * 0.9) return;
    if (hasAutoFilledScenesRef.current) return;
    hasAutoFilledScenesRef.current = true;
    const total = voiceoverDuration;
    const segDuration = total / scenes.length;
    setScenes((prev) =>
      prev.map((s, i) => ({ ...s, startTime: i * segDuration, duration: segDuration }))
    );
    setSelectedSceneIndex(null);
    setExpandedSceneIndex(null);
  }, [voiceoverDuration, duration, scenes.length]);

  /** Remove gaps between scenes: place each scene back-to-back (sorted timeline order). */
  const handleCompactScenes = useCallback(() => {
    pushUndoSnapshot();
    setScenes((prev) => collapseAllSceneGapsToContiguous(prev));
    setSelectedSceneIndex(null);
    setExpandedSceneIndex(null);
  }, [pushUndoSnapshot]);

  /** Split selected scene at current playhead. */
  const handleSplitScene = useCallback(() => {
    if (selectedSceneIndex === null || selectedSceneIndex < 0 || selectedSceneIndex >= scenes.length) return;
    const block = sceneBlocks.find((b) => scenes[selectedSceneIndex].id === b.id);
    if (!block) return;
    pushUndoSnapshot();
    const { startTime, endTime } = block;
    if (currentTime <= startTime || currentTime >= endTime) return;
    const scene = scenes[selectedSceneIndex];
    const newDurationLeft = currentTime - startTime;
    const newDurationRight = endTime - currentTime;
    if (newDurationLeft < 0.5 || newDurationRight < 0.5) return;
    const newScene = createScene(
      `scene_${Date.now()}`,
      `${scene.title} (cont.)`,
      newDurationRight,
      scene.color,
      currentTime
    );
    newScene.elements = scene.elements.map((el) => ({ ...el, id: `${newScene.id}-${el.id}` }));
    if (newScene.elements[0] && "media" in newScene.elements[0]) {
      (newScene.elements[0] as BackgroundElement).media = (scene.elements[0] as BackgroundElement)?.media ?? null;
    }
    setScenes((prev) =>
      prev.map((s, i) =>
        i === selectedSceneIndex
          ? { ...s, startTime: s.startTime ?? startTime, duration: newDurationLeft }
          : s
      ).concat([newScene])
    );
    setSelectedSceneIndex(scenes.length);
    setExpandedSceneIndex(null);
  }, [selectedSceneIndex, scenes, sceneBlocks, currentTime, pushUndoSnapshot]);

  const handleAddCaption = useCallback(() => {
    pushUndoSnapshot();
    const startTime = currentTime;
    const duration = 2;
    const newCaption: CaptionBlock = {
      id: `cap-${Date.now()}`,
      text: "Enter caption text",
      startTime,
      endTime: startTime + duration,
    };
    setCaptions((prev) => [...prev, newCaption]);
    setSelectedCaptionId(newCaption.id);
    setSelectedSceneIndex(null);
  }, [currentTime, pushUndoSnapshot]);

  /** Generate subtitles from voiceover using Whisper; replaces captions with timed segments. */
  const handleGenerateSubtitlesFromVoiceover = useCallback(async () => {
    if (!voiceoverUrl) {
      setTranscribeError("Add or load a voiceover first.");
      return;
    }
    setTranscribeError(null);
    setTranscribeLoading(true);
    try {
      const isBlob = voiceoverUrl.startsWith("blob:");
      let res: Response;
      if (isBlob) {
        const blob = await fetch(voiceoverUrl).then((r) => r.blob());
        const formData = new FormData();
        formData.append("audio", blob, "voiceover.mp3");
        res = await fetch("/api/video-timeline/transcribe", {
          method: "POST",
          body: formData,
        });
      } else {
        res = await fetch("/api/video-timeline/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ voiceoverUrl }),
        });
      }
      const data = (await res.json().catch(() => ({}))) as {
        segments?: Array<{ text: string; start: number; end: number }>;
        words?: Array<{ word: string; start: number; end: number }>;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? `Transcription failed (${res.status})`);
      }
      const segments = data.segments ?? [];
      if (segments.length === 0) {
        setTranscribeError("No speech detected in the voiceover.");
        return;
      }
      const words = data.words ?? [];
      // Assign each word to the segment that contains its start time (for word-by-word sync)
      const segmentWordTimings = segments.map((seg) => {
        const segWords = words.filter(
          (w) => typeof w.start === "number" && w.start >= seg.start && w.start < seg.end
        ) as WordTiming[];
        return segWords.length > 0 ? segWords : undefined;
      });
      pushUndoSnapshot();
      const newCaptions: CaptionBlock[] = segments.map((seg, i) => ({
        id: `cap-${Date.now()}-${i}`,
        text: seg.text,
        startTime: seg.start,
        endTime: seg.end,
        wordTimings: segmentWordTimings[i],
      }));
      setCaptions(newCaptions);
      setSelectedCaptionId(null);
      setSelectedSceneIndex(null);
      // Expand timeline to match transcribed length so ruler and playback cover full voiceover
      const transcribedEnd = Math.max(0, ...segments.map((s) => s.end));
      if (transcribedEnd > 0) {
        setVoiceoverDuration((prev) => (prev < transcribedEnd ? transcribedEnd : prev));
      }
    } catch (err) {
      setTranscribeError(err instanceof Error ? err.message : "Failed to generate subtitles");
    } finally {
      setTranscribeLoading(false);
    }
  }, [voiceoverUrl, pushUndoSnapshot]);

  /** Export current captions as an SRT file for use in other tools or platforms. */
  const handleExportSrt = useCallback(() => {
    const sorted = [...captions].sort((a, b) => a.startTime - b.startTime);
    if (sorted.length === 0) return;
    const toSrtTime = (sec: number) => {
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = Math.floor(sec % 60);
      const ms = Math.round((sec % 1) * 1000);
      return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")},${ms.toString().padStart(3, "0")}`;
    };
    const lines: string[] = [];
    sorted.forEach((cap, i) => {
      lines.push(String(i + 1));
      lines.push(`${toSrtTime(cap.startTime)} --> ${toSrtTime(cap.endTime)}`);
      const line = stripSpeakerPrefix(cap.text || "").replace(/\r?\n/g, " ").trim() || "(no text)";
      lines.push(line);
      lines.push("");
    });
    const blob = new Blob([lines.join("\r\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subtitles-${Date.now()}.srt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [captions]);

  const updateCaption = useCallback((id: string, updates: Partial<Pick<CaptionBlock, "text" | "startTime" | "endTime">>) => {
    setCaptions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  }, []);

  const deleteCaption = useCallback((id: string) => {
    pushUndoSnapshot();
    setCaptions((prev) => prev.filter((c) => c.id !== id));
    if (selectedCaptionId === id) setSelectedCaptionId(null);
  }, [selectedCaptionId, pushUndoSnapshot]);

  const handleVoiceoverUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const prevUrl = voiceoverUrl;
    if (prevUrl && voiceoverFileName) URL.revokeObjectURL(prevUrl);
    setVoiceoverUrl(URL.createObjectURL(file));
    setVoiceoverFileName(file.name);
    setCaptions([]);
    e.target.value = "";
  }, [voiceoverUrl, voiceoverFileName]);

  const removeVoiceover = useCallback(() => {
    if (voiceoverUrl && voiceoverFileName) URL.revokeObjectURL(voiceoverUrl);
    setVoiceoverUrl(null);
    setVoiceoverFileName(null);
    setVoiceoverDuration(0);
  }, [voiceoverUrl, voiceoverFileName]);

  /** Apply template from customize modal (VideoTemplate + custom duration/scene count). */
  const applyCustomTemplate = useCallback((template: VideoTemplate, totalDuration: number, sceneCount: number) => {
    setSelectedTemplate(template);
    const sceneDuration = totalDuration / sceneCount;
    let run = 0;
    const generatedScenes = Array.from({ length: sceneCount }, (_, i) => {
      const scene = createScene(`scene_${i + 1}`, `Scene ${i + 1}`, sceneDuration, SCENE_COLORS[i % SCENE_COLORS.length], run);
      run += sceneDuration;
      return scene;
    });
    setScenes(generatedScenes);
    setSelectedSceneIndex(null);
    setAspectRatio(template.aspectRatio);
    setShowCustomize(false);
    setPendingTemplate(null);
  }, []);

  const handleTemplateSelect = useCallback((template: VideoTemplate) => {
    if (template.id === "custom") {
      setSelectedTemplate(template);
      setAspectRatio(template.aspectRatio);
      setScenes([]);
      setSelectedSceneIndex(null);
      return;
    }
    // Open "Customize Your Video" modal so user can set duration and scene count before creating timeline
    setPendingTemplate(template);
    setCustomDuration(template.defaultDuration ?? 30);
    setCustomSceneCount(template.defaultSceneCount ?? 5);
    setShowCustomize(true);
  }, []);

  // Only show Loading when we need the client to load script/project; otherwise show timeline so we don't get stuck
  if (!isBrowser && (scriptId || projectIdFromUrl)) {
    return (
      <div className="flex flex-1 min-h-0 w-full items-center justify-center bg-background text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!selectedTemplate) {
    return (
      <div className="flex flex-1 min-h-0 w-full items-center justify-center overflow-auto bg-muted/30 py-8">
        <div className="max-w-4xl w-full p-8">
          <h2 className="text-2xl font-bold text-foreground mb-2">Choose Your Video Format</h2>
          <p className="text-muted-foreground mb-6">Select a template to get started, or build custom</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {VIDEO_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleTemplateSelect(template);
                }}
                className="p-6 bg-card rounded-lg border-2 border-border hover:border-primary transition-colors text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              >
                <div className="text-4xl mb-2 pointer-events-none">{template.icon}</div>
                <h3 className="font-bold text-lg text-foreground pointer-events-none">{template.name}</h3>
                <p className="text-sm text-muted-foreground pointer-events-none">{template.description}</p>
                <p className="text-xs text-muted-foreground mt-2 pointer-events-none">
                  {template.durationRange[0]}-{template.durationRange[1]}s • {template.sceneRange[0]}-{template.sceneRange[1]} scenes
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Customization modal: duration + scene count before creating timeline */}
        {showCustomize && pendingTemplate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" role="dialog" aria-modal="true" aria-labelledby="customize-video-title">
            <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full shadow-lg text-foreground">
              <h3 id="customize-video-title" className="text-xl font-bold mb-4">Customize Your Video</h3>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Total Video Duration (seconds)</label>
                <input
                  type="number"
                  min={pendingTemplate.durationRange[0]}
                  max={pendingTemplate.durationRange[1]}
                  value={customDuration}
                  onChange={(e) => {
                    const [lo, hi] = pendingTemplate.durationRange;
                    const v = parseInt(e.target.value, 10);
                    setCustomDuration(Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo);
                  }}
                  className="w-full px-3 py-2 border border-input rounded bg-background text-foreground"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Range: {pendingTemplate.durationRange[0]}-{pendingTemplate.durationRange[1]}s • Default: {pendingTemplate.defaultDuration}s for {pendingTemplate.name}
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Number of Scenes</label>
                <input
                  type="number"
                  min={pendingTemplate.sceneRange[0]}
                  max={pendingTemplate.sceneRange[1]}
                  value={customSceneCount}
                  onChange={(e) => {
                    const [lo, hi] = pendingTemplate.sceneRange;
                    const v = parseInt(e.target.value, 10);
                    setCustomSceneCount(Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo);
                  }}
                  className="w-full px-3 py-2 border border-input rounded bg-background text-foreground"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Range: {pendingTemplate.sceneRange[0]}-{pendingTemplate.sceneRange[1]} scenes • Default: {pendingTemplate.defaultSceneCount} for {pendingTemplate.name}
                </p>
              </div>

              <div className="bg-muted/50 p-3 rounded mb-4">
                <p className="text-sm">
                  <strong>Each scene:</strong> ~{Math.round((customDuration / customSceneCount) * 10) / 10}s
                </p>
                <p className="text-xs text-muted-foreground mt-1">(You can adjust individual scene durations later)</p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomize(false);
                    setPendingTemplate(null);
                  }}
                  className="flex-1 px-4 py-2 border border-border rounded bg-background text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => applyCustomTemplate(pendingTemplate, customDuration, customSceneCount)}
                  className="flex-1 px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
                >
                  Create Timeline
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="min-w-0 max-w-full overflow-hidden" style={{ height: "100vh" }}>
        <div
          className={`fixed top-0 right-0 bottom-0 z-50 flex min-w-0 flex-col overflow-x-hidden overflow-y-hidden bg-[#0f0f0f] text-white transition-[left] duration-200 ease-out ${sidebar && !sidebar.isCollapsed ? "left-[60px] md:left-[220px]" : "left-0"}`}
        >
      <header className="shrink-0 border-b border-[#2a2a2a] bg-[#0f0f0f] px-3 h-12 flex items-center">
        <div className="flex items-center gap-2 w-full">
          {sidebar && (
            <button
              type="button"
              onClick={sidebar.toggleCollapsed}
              className="flex-shrink-0 p-1.5 rounded text-[#a0a0a0] hover:bg-[#2a2a2a] hover:text-white transition-colors"
              aria-label={sidebar.isCollapsed ? "Show sidebar" : "Hide sidebar"}
            >
              {sidebar.isCollapsed ? (
                <Menu size={18} />
              ) : (
                <PanelLeftClose size={18} />
              )}
            </button>
          )}
          <input
            type="text"
            className="bg-transparent text-white font-semibold text-sm border-none outline-none focus:ring-1 focus:ring-[#2a2a2a] rounded px-1 py-0.5 min-w-0 max-w-[200px]"
            value={scriptName ?? "Untitled Project"}
            readOnly
            aria-label="Project name"
          />
          <div className="flex-1" />
          <button
            type="button"
            className="p-1.5 rounded text-[#a0a0a0] hover:bg-[#2a2a2a] hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-colors"
            onClick={undo}
            disabled={undoStack.length === 0}
            title="Undo (Cmd+Z)"
            aria-label="Undo"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="p-1.5 rounded text-[#a0a0a0] hover:bg-[#2a2a2a] hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-colors"
            onClick={redo}
            disabled={redoStack.length === 0}
            title="Redo (Cmd+Shift+Z)"
            aria-label="Redo"
          >
            <Redo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm text-[#a0a0a0] hover:bg-[#2a2a2a] hover:text-white border border-[#2a2a2a] transition-colors"
            onClick={handleSaveToLibrary}
          >
            💾 Save
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm text-white bg-[#f97316] hover:bg-orange-600 font-medium disabled:opacity-50 disabled:pointer-events-none transition-colors"
            disabled={compileLoading || !scriptId?.trim()}
            onClick={handleExportVideoServer}
          >
            {compileLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Export Video
          </button>
        </div>
      </header>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#0f0f0f]">
        {/* Template picker when no scenes */}
        {sceneBlocks.length === 0 ? (
          <>
            <div className="flex flex-col items-center justify-center gap-6 py-12">
              <h2 className="text-lg font-semibold text-white">Start from a template</h2>
              <p className="text-sm text-[#a0a0a0]">Choose a structure or select a script to load its scenes.</p>
              <div className="flex flex-wrap justify-center gap-4">
                {(Object.keys(TEMPLATES) as (keyof typeof TEMPLATES)[]).map((key) => {
                  const t = TEMPLATES[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setPendingTemplatesKey(key);
                        setCustomDuration(t.duration);
                        setCustomSceneCount(t.sceneCount);
                      }}
                      className="flex flex-col items-start gap-1 rounded-xl border-2 border-border bg-card p-5 text-left w-52 hover:border-primary hover:bg-muted/50 transition-colors"
                    >
                      <span className="font-medium text-foreground">{t.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {t.sceneCount} scenes · {t.duration}s · {t.aspectRatio}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Modal: duration + scene count after template selection (e.g. TikTok Short) */}
            {pendingTemplatesKey && (() => {
              const t = TEMPLATES[pendingTemplatesKey];
              const [durMin, durMax] = t.durationRange;
              const [sceneMin, sceneMax] = t.sceneRange;
              const perScene = customSceneCount > 0 ? Math.round((customDuration / customSceneCount) * 10) / 10 : 0;
              return (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]" role="dialog" aria-modal="true" aria-labelledby="template-modal-title">
                  <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full shadow-xl text-foreground mx-4">
                    <h3 id="template-modal-title" className="text-xl font-bold mb-4">Customize: {t.name}</h3>

                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2">Duration (seconds)</label>
                      <input
                        type="number"
                        min={durMin}
                        max={durMax}
                        value={customDuration}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          setCustomDuration(Number.isFinite(v) ? Math.max(durMin, Math.min(durMax, v)) : durMin);
                        }}
                        className="w-full px-3 py-2 border border-input rounded bg-background text-foreground"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Range: {durMin}–{durMax}s · Default: {t.duration}s
                      </p>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2">Scene count</label>
                      <input
                        type="number"
                        min={sceneMin}
                        max={sceneMax}
                        value={customSceneCount}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          setCustomSceneCount(Number.isFinite(v) ? Math.max(sceneMin, Math.min(sceneMax, v)) : sceneMin);
                        }}
                        className="w-full px-3 py-2 border border-input rounded bg-background text-foreground"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Range: {sceneMin}–{sceneMax} scenes · Default: {t.sceneCount}
                      </p>
                    </div>

                    <div className="bg-muted/50 p-3 rounded mb-4">
                      <p className="text-sm">
                        Each scene will be ~{perScene}s
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPendingTemplatesKey(null)}
                        className="flex-1 px-4 py-2 border border-border rounded bg-background text-foreground hover:bg-muted"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          applyTemplateWithCustom(pendingTemplatesKey, customDuration, customSceneCount);
                        }}
                        className="flex-1 px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 font-medium"
                      >
                        Create Timeline
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </>
        ) : (
          <>
        {/* MIDDLE ROW: left panel + preview + properties panel */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* LEFT PANEL: media / audio library */}
          <div className="w-44 shrink-0 border-r border-[#2a2a2a] bg-[#1a1a1a] flex flex-col">
            {/* Tabs */}
            <div className="flex border-b border-[#2a2a2a] shrink-0">
              {(["media", "audio"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setLeftPanelTab(tab)}
                  className={`flex-1 py-2 text-[11px] font-medium capitalize transition-colors ${leftPanelTab === tab ? "text-white border-b-2 border-[#f97316]" : "text-[#a0a0a0] hover:text-white"}`}
                >
                  {tab === "media" ? "Media" : "Audio"}
                </button>
              ))}
            </div>

            {/* Hidden file inputs */}
            <input ref={leftMediaInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => {
              Array.from(e.target.files ?? []).forEach((file) => {
                const url = URL.createObjectURL(file);
                const type = file.type.startsWith("video/") ? "video" : "image";
                setMediaLibrary((prev) => [...prev, { id: `media-${Date.now()}-${Math.random()}`, url, type, name: file.name }]);
              });
              e.target.value = "";
            }} />
            <input ref={leftAudioInputRef} type="file" accept="audio/*" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const objUrl = URL.createObjectURL(file);
              if (!voiceoverUrl) {
                setVoiceoverUrl(objUrl);
                setVoiceoverFileName(file.name);
                const a = new Audio(objUrl);
                a.addEventListener('loadedmetadata', () => setVoiceoverDuration(a.duration), { once: true });
                setCaptions([]);
              } else {
                const prev2 = musicUrl;
                if (prev2) URL.revokeObjectURL(prev2);
                setMusicUrl(objUrl);
              }
              e.target.value = "";
            }} />

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-2">
              {leftPanelTab === "media" ? (
                <>
                  {/* Auto-fill button */}
                  <button
                    type="button"
                    onClick={autoFillScenes}
                    disabled={autoFillLoading || scenes.length === 0}
                    className="w-full mb-2 py-1.5 rounded-md bg-[#f97316] hover:bg-[#ea6b10] disabled:opacity-50 disabled:cursor-not-allowed text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    title="Auto-fill all scenes with relevant stock photos from Pexels"
                  >
                    {autoFillLoading ? (
                      <><span className="animate-spin">⟳</span> Filling scenes…</>
                    ) : (
                      <><span>✦</span> Auto-fill with stock photos</>
                    )}
                  </button>

                  {/* Stock photo search */}
                  <div className="flex gap-1 mb-2">
                    <input
                      type="text"
                      value={stockQuery}
                      onChange={(e) => setStockQuery(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") searchStockPhotos(stockQuery); }}
                      placeholder="Search stock photos…"
                      className="flex-1 min-w-0 px-2 py-1 rounded bg-[#0f0f0f] border border-[#2a2a2a] text-white text-[10px] placeholder-[#606060] focus:outline-none focus:border-[#f97316]"
                    />
                    <button
                      type="button"
                      onClick={() => searchStockPhotos(stockQuery)}
                      disabled={stockLoading}
                      className="px-2 py-1 rounded bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#a0a0a0] text-[10px] shrink-0 transition-colors"
                    >
                      {stockLoading ? "…" : "Go"}
                    </button>
                  </div>

                  {/* Stock photo results */}
                  {stockPhotos.length > 0 && (
                    <div className="grid grid-cols-2 gap-1 mb-2">
                      {stockPhotos.map((photo) => (
                        <div
                          key={photo.id}
                          className="relative aspect-video rounded overflow-hidden bg-[#0f0f0f] cursor-grab border border-[#2a2a2a] hover:border-[#f97316]/50 group"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("application/x-media-url", photo.url);
                            e.dataTransfer.setData("application/x-media-type", "image");
                            e.dataTransfer.setData("application/x-media-name", `stock-${photo.id}`);
                          }}
                          title="Drag to a scene or click to apply to selected scene"
                        >
                          <img src={photo.thumb} alt="" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                          {selectedSceneIndex !== null && (
                            <button
                              type="button"
                              className="absolute bottom-0 left-0 right-0 bg-[#f97316] text-white text-[9px] py-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                setScenes((prev) => prev.map((s, si) => si !== selectedSceneIndex ? s : {
                                  ...s,
                                  elements: s.elements.map((el, ei) => ei === 0 ? { ...el, media: { url: photo.url, type: "image" as const } } : el),
                                }));
                              }}
                            >
                              Use in scene {(selectedSceneIndex ?? 0) + 1}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Divider */}
                  {(stockPhotos.length > 0 || mediaLibrary.length > 0) && (
                    <p className="text-[9px] text-[#404040] uppercase tracking-wide mb-1 mt-1">Your uploads</p>
                  )}

                  {/* Drop zone / add button */}
                  <div
                    className="w-full aspect-video rounded border-2 border-dashed border-[#2a2a2a] flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-[#f97316]/50 hover:bg-[#f97316]/5 transition-colors mb-2"
                    onClick={() => leftMediaInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-[#f97316]'); }}
                    onDragLeave={(e) => { e.currentTarget.classList.remove('border-[#f97316]'); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-[#f97316]');
                      Array.from(e.dataTransfer.files).forEach((file) => {
                        if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
                          const url = URL.createObjectURL(file);
                          const type = file.type.startsWith("video/") ? "video" : "image";
                          setMediaLibrary((prev) => [...prev, { id: `media-${Date.now()}-${Math.random()}`, url, type, name: file.name }]);
                        }
                      });
                    }}
                  >
                    <span className="text-[#a0a0a0] text-xl">+</span>
                    <span className="text-[10px] text-[#a0a0a0] text-center leading-tight">Drop or click<br/>to add media</span>
                  </div>
                  {/* Thumbnails grid */}
                  <div className="grid grid-cols-2 gap-1">
                    {mediaLibrary.map((item) => (
                      <div
                        key={item.id}
                        className="relative aspect-video rounded overflow-hidden bg-[#0f0f0f] cursor-grab border border-[#2a2a2a] hover:border-[#f97316]/50 group"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("application/x-media-url", item.url);
                          e.dataTransfer.setData("application/x-media-type", item.type);
                          e.dataTransfer.setData("application/x-media-name", item.name);
                        }}
                        title={item.name}
                      >
                        {item.type === "image" ? (
                          <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <video src={item.url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                        {selectedSceneIndex !== null && (
                          <button
                            type="button"
                            className="absolute bottom-0 left-0 right-0 bg-[#f97316] text-white text-[9px] py-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => {
                              if (selectedSceneIndex === null) return;
                              setScenes((prev) => prev.map((s, si) => si !== selectedSceneIndex ? s : {
                                ...s,
                                elements: s.elements.map((el, ei) => ei === 0 ? { ...el, media: { url: item.url, type: item.type } } : el),
                              }));
                            }}
                            title="Add to selected scene"
                          >
                            Use in scene {(selectedSceneIndex ?? 0) + 1}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {mediaLibrary.length === 0 && (
                    <p className="text-[10px] text-[#a0a0a0]/50 text-center mt-2">Your media appears here</p>
                  )}
                </>
              ) : (
                <>
                  {/* Audio drop zone */}
                  <div
                    className="w-full rounded border-2 border-dashed border-[#2a2a2a] flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-[#f97316]/50 hover:bg-[#f97316]/5 transition-colors p-3 mb-2"
                    onClick={() => leftAudioInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-[#f97316]'); }}
                    onDragLeave={(e) => { e.currentTarget.classList.remove('border-[#f97316]'); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-[#f97316]');
                      const file = e.dataTransfer.files?.[0];
                      if (!file || !file.type.startsWith('audio/')) return;
                      const objUrl = URL.createObjectURL(file);
                      if (!voiceoverUrl) {
                        setVoiceoverUrl(objUrl); setVoiceoverFileName(file.name);
                        const a = new Audio(objUrl);
                        a.addEventListener('loadedmetadata', () => setVoiceoverDuration(a.duration), { once: true });
                        setCaptions([]);
                      } else {
                        const prev2 = musicUrl; if (prev2) URL.revokeObjectURL(prev2); setMusicUrl(objUrl);
                      }
                    }}
                  >
                    <span className="text-[#a0a0a0] text-xl">🎵</span>
                    <span className="text-[10px] text-[#a0a0a0] text-center leading-tight">Drop audio here<br/>(voice or music)</span>
                  </div>
                  {voiceoverUrl && (
                    <div className="flex items-center gap-1 p-1.5 rounded bg-[#2a2a2a] mb-1">
                      <span className="text-[9px] text-white truncate flex-1">🎙 {voiceoverFileName ?? "Voiceover"}</span>
                    </div>
                  )}
                  {musicUrl && (
                    <div className="flex items-center gap-1 p-1.5 rounded bg-[#2a2a2a]">
                      <span className="text-[9px] text-white truncate flex-1">🎵 Music</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Preview area: centered in dark bg */}
          <div className="flex-1 flex items-center justify-center bg-[#111111]">
            <div
              ref={previewRef}
              className="relative overflow-hidden rounded-lg border border-[#2a2a2a] shadow-sm"
              style={{
                aspectRatio: aspectRatio.replace(":", "/"),
                width: aspectRatio === "16:9" ? 400 : 280,
                backgroundColor: "#374151",
              }}
            >
            {/* Preview: background + elements layered; crossfade when nearing next scene */}
            {activeScene && (() => {
              const sortedBlocks = [...sceneBlocks].sort((a, b) => a.startTime - b.startTime);
              const currentIdx = sortedBlocks.findIndex((b) => b.id === activeScene.scene.id);
              const nextBlock = currentIdx >= 0 && currentIdx < sortedBlocks.length - 1 ? sortedBlocks[currentIdx + 1] : null;
              const PREVIEW_XFADE = 0.25; // Short transition so scenes flow with no visible gap
              const PREVIEW_NEXT_MOUNT_LEAD = 0.5; // Mount next layer early so video can decode (reduces black at cut)
              const xfadeStart = activeScene.scene.endTime - PREVIEW_XFADE;
              const inTransitionZone = nextBlock && currentTime >= xfadeStart && currentTime < activeScene.scene.endTime;
              const inNextLayerMountZone =
                nextBlock && currentTime >= xfadeStart - PREVIEW_NEXT_MOUNT_LEAD && currentTime < activeScene.scene.endTime;
              const xfadeProgress = inTransitionZone
                ? Math.min(1, (currentTime - xfadeStart) / PREVIEW_XFADE)
                : 0;

              const idx = scenes.findIndex((s) => s.id === activeScene.scene.id);
              const sceneData = idx >= 0 ? scenes[idx] : null;
              const backgroundMedia = sceneData ? getSceneBackgroundMedia(sceneData) : null;
              const sceneColor = sceneData?.color ?? getScenePreviewColor(idx >= 0 ? idx : 0);
              // No black: when scene has no media always use a visible gray so preview never shows black
              const placeholderColor = !backgroundMedia ? "#4b5563" : (() => {
                const hex = (sceneColor ?? "").replace(/^#/, "");
                if (hex.length !== 6) return "#4b5563";
                const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
                const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                return luminance < 0.2 ? "#4b5563" : sceneColor;
              })();
              const elements = sceneData?.elements ?? [];

              const nextSceneData = nextBlock ? scenes.find((s) => s.id === nextBlock.id) : null;
              const nextMedia = nextSceneData ? getSceneBackgroundMedia(nextSceneData) : null;
              const nextColorRaw = nextSceneData?.color ?? getScenePreviewColor(currentIdx + 1);
              const nextColor = !nextMedia ? "#4b5563" : nextColorRaw;

              // Transition styles: current layer moves/clips; next layer stays put (we reveal it) or fades/zooms
              const p = xfadeProgress;
              // Easing: smooth ease-in-out curve for more cinematic transitions
              const ep = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
              const currentLayerStyle: React.CSSProperties = (() => {
                const base = { zIndex: 1, willChange: "transform" as const };
                switch (sceneTransitionType) {
                  case "slideLeft":
                    return { ...base, transform: `translateX(${-100 * ep}%)` };
                  case "slideRight":
                    return { ...base, transform: `translateX(${100 * ep}%)` };
                  case "wipe":
                    return { zIndex: 1, clipPath: `inset(0 ${100 * ep}% 0 0)` };
                  case "zoom":
                    return { ...base, transform: `scale(${1 + 0.3 * ep})`, opacity: 1 - ep };
                  case "pushUp":
                    return { ...base, transform: `translateY(${-100 * ep}%)` };
                  case "pushDown":
                    return { ...base, transform: `translateY(${100 * ep}%)` };
                  case "blur":
                    return { zIndex: 1, filter: `blur(${ep * 20}px)`, opacity: 1 - ep * 0.5, willChange: "filter" as const };
                  case "spin":
                    return { ...base, transform: `rotate(${90 * ep}deg) scale(${1 - 0.3 * ep})`, opacity: 1 - ep };
                  case "flip":
                    return { zIndex: 1, transform: `perspective(600px) rotateY(${90 * ep}deg)`, willChange: "transform" as const };
                  default:
                    return { zIndex: 1, opacity: 1 - ep };
                }
              })();
              const nextLayerStyle: React.CSSProperties = (() => {
                // Next sits under current at z-index 0. For fade/zoom: keep next at opacity 1 and only fade the TOP layer
                // (opacity: p on BOTH layers lets the preview background #374151 show through → black/gray flashes).
                switch (sceneTransitionType) {
                  case "zoom": return { opacity: 1, transform: `scale(${0.7 + 0.3 * ep})` };
                  case "pushUp": return { transform: `translateY(${100 * (1 - ep)}%)` };
                  case "pushDown": return { transform: `translateY(${-100 * (1 - ep)}%)` };
                  case "blur": return { opacity: ep * 0.5 + 0.5 };
                  case "spin": return { opacity: ep, transform: `scale(${0.7 + 0.3 * ep})` };
                  case "flip": return { transform: `perspective(600px) rotateY(${-90 * (1 - ep)}deg)` };
                  default: return { opacity: 1 };
                }
              })();

              return (
                <div className="absolute inset-0 w-full h-full" style={{ overflow: "hidden" }}>
                  {/* Next scene layer: mount slightly before xfade so next video/image can load; current stays fully opaque until xfade (p=0). */}
                  {inNextLayerMountZone && nextBlock && nextSceneData && (
                    <div className="absolute inset-0 w-full h-full" style={{ zIndex: 0, ...nextLayerStyle }}>
                      {nextMedia?.type === "image" ? (
                        <img src={nextMedia.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      ) : nextMedia?.type === "video" ? (
                        <video
                          ref={nextSceneVideoRef}
                          src={nextMedia.url}
                          muted
                          playsInline
                          preload="auto"
                          className="absolute inset-0 w-full h-full object-cover"
                          style={{ objectFit: "cover" }}
                        />
                      ) : (
                        <div
                          className="absolute inset-0 w-full h-full bg-cover bg-center"
                          style={{
                            background: "linear-gradient(135deg, #1e3a5f 0%, #2d5a87 25%, #3d7ab5 50%, #5b9bd5 75%, #7eb8e8 100%)",
                            backgroundSize: "200% 200%",
                            animation: "video-placeholder-shift 8s ease-in-out infinite",
                          }}
                        />
                      )}
                    </div>
                  )}
                  {/* Current scene (transition out) */}
                  <div className="absolute inset-0 w-full h-full" style={currentLayerStyle}>
                  {/* Background */}
                  {backgroundMedia?.type === "image" ? (
                    <img
                      src={backgroundMedia.url}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : backgroundMedia?.type === "video" ? (
                    <video
                      key={activeScene.scene.id}
                      ref={sceneVideoRef}
                      src={backgroundMedia.url}
                      muted
                      playsInline
                      preload="auto"
                      className="absolute inset-0 w-full h-full object-cover"
                      onLoadedMetadata={(e) => {
                        const v = e.currentTarget;
                        const start = activeScene.scene.startTime;
                        const localTime = Math.max(0, currentTime - start);
                        v.currentTime = localTime;
                      }}
                    />
                  ) : (
                    <div
                      className="absolute inset-0 w-full h-full bg-cover bg-center"
                      style={{
                        background: "linear-gradient(135deg, #1e3a5f 0%, #2d5a87 25%, #3d7ab5 50%, #5b9bd5 75%, #7eb8e8 100%)",
                        backgroundSize: "200% 200%",
                        animation: "video-placeholder-shift 8s ease-in-out infinite",
                      }}
                    >
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="text-white/40 text-xs font-medium px-3 py-1.5 rounded-full bg-black/20 backdrop-blur-sm">
                          Add video or image
                        </span>
                      </div>
                    </div>
                  )}
                  {/* Elements overlay */}
                  {elements.slice(1).map((element) => (
                    <div
                      key={element.id}
                      className="absolute pointer-events-none"
                      style={{
                        left: `${"position" in element && element.position ? element.position.x : 50}%`,
                        top: `${"position" in element && element.position ? element.position.y : 50}%`,
                        transform: "translate(-50%, -50%)",
                      }}
                    >
                      {isTextEl(element) && (
                        <p style={{ fontSize: `${element.fontSize}px`, color: element.color }}>
                          {element.content || "Text"}
                        </p>
                      )}
                      {isImageEl(element) && element.media?.url && (
                        <img
                          src={element.media.url}
                          alt=""
                          className="object-contain"
                          style={{
                            width: `${element.size.w}px`,
                            height: `${element.size.h}px`,
                          }}
                        />
                      )}
                      {isGraphicEl(element) && (
                        <div
                          style={{
                            width: `${element.size ?? 100}px`,
                            height: `${element.size ?? 100}px`,
                            backgroundColor: element.color,
                            borderRadius: element.shape === "circle" ? "50%" : element.shape === "triangle" ? 0 : "4px",
                            clipPath: element.shape === "triangle" ? "polygon(50% 0%, 0% 100%, 100% 100%)" : undefined,
                          }}
                        />
                      )}
                      {isStickerEl(element) && element.media?.url && (
                        <img
                          src={element.media.url}
                          alt=""
                          className="object-contain"
                          style={{
                            width: `${element.size ?? 100}px`,
                            height: `${element.size ?? 100}px`,
                          }}
                        />
                      )}
                    </div>
                  ))}
                  </div>
                </div>
              );
            })()}
            {!activeScene && (
              <div className="absolute inset-0 flex items-center justify-center text-zinc-300 text-sm" style={{ backgroundColor: "#4b5563" }}>
                {voiceoverUrl ? "Voiceover plays here" : hasPerClipAudio ? "Per-clip audio plays here" : "Select a script with voiceover or use scenes with audio"}
              </div>
            )}
            {activeCaption && (
              <>
                {/* Caption overlay */}
                <div
                  style={{ zIndex: 9999 }}
                  className={`absolute inset-0 pointer-events-none flex items-center justify-center`}
                >
                  <div
                    className={`absolute left-0 right-0 flex justify-center px-4 pointer-events-none ${
                      captionPosition === "top"
                        ? "top-[10%]"
                        : captionPosition === "middle"
                          ? "top-1/2 -translate-y-1/2"
                          : "bottom-[10%]"
                    }`}
                  >
                    {(captionDisplayMode === "wordByWord" || captionDisplayMode === "singleWord") ? (() => {
                      const hasWordTimings = Array.isArray(activeCaption.wordTimings) && activeCaption.wordTimings.length > 0;
                      let words: string[];
                      let wordEndTimes: number[];
                      if (hasWordTimings) {
                        const rawWords = activeCaption.wordTimings!.map((w) => w.word);
                        const rawEndTimes = activeCaption.wordTimings!.map((w) => w.end);
                        const colonIndex = rawWords.findIndex((w) => w.trim() === ":");
                        const dropCount = colonIndex >= 0 ? colonIndex + 1 : 0;
                        words = dropCount > 0 ? rawWords.slice(dropCount) : rawWords;
                        wordEndTimes = dropCount > 0 ? rawEndTimes.slice(dropCount) : rawEndTimes;
                      } else {
                        words = stripSpeakerPrefix(activeCaption.text).split(/\s+/).filter(Boolean);
                        wordEndTimes = [];
                      }
                      const start = activeCaption.startTime;
                      const end = activeCaption.endTime;
                      const dur = Math.max(0.001, end - start);
                      if (!hasWordTimings) {
                        const totalChars = words.reduce((s, w) => s + Math.max(w.length, 1), 0);
                        if (words.length === 0 || totalChars <= 0) wordEndTimes = [end];
                        else {
                          let t = start;
                          for (let i = 0; i < words.length; i++) {
                            const part = (Math.max(words[i].length, 1) / totalChars) * dur;
                            t = t + part;
                            wordEndTimes.push(i === words.length - 1 ? end : t);
                          }
                        }
                      }
                      let currentWordIndex = 0;
                      for (let i = 0; i < wordEndTimes.length; i++) {
                        if (currentTime < wordEndTimes[i]) {
                          currentWordIndex = i;
                          break;
                        }
                        currentWordIndex = i;
                      }
                      currentWordIndex = Math.min(currentWordIndex, words.length - 1);
                      const currentWord = words[currentWordIndex] ?? "";
                      const showOnlyOneWord = captionDisplayMode === "singleWord";
                      return (
                        <p
                          key={activeCaption.id}
                          className={`max-w-full font-bold text-center ${showOnlyOneWord ? "" : "inline-flex flex-wrap justify-center gap-x-1.5 gap-y-0"} ${
                            captionBackground === "pill"
                              ? "bg-background/80 px-4 py-2 rounded-lg"
                              : captionBackground === "bar"
                                ? "bg-background/80 px-4 py-2 w-full rounded-none"
                                : "px-1 py-0.5"
                          } ${
                            captionAnimation === "fadeIn"
                              ? "caption-animate-fade-in"
                              : captionAnimation === "slideUp"
                                ? "caption-animate-slide-up"
                                : captionAnimation === "pop"
                                  ? "caption-animate-pop"
                                  : ""
                          }`}
                          style={{
                            fontSize: captionFontSize === "small" ? 18 : captionFontSize === "large" ? 28 : 22,
                            color: captionTextColor,
                            textShadow: captionBackground === "none" ? "2px 2px 4px rgba(0,0,0,0.9)" : "1px 1px 2px rgba(0,0,0,0.6)",
                          }}
                        >
                          {showOnlyOneWord ? (
                            currentWord
                          ) : (
                            words.map((word, i) => (
                              <span
                                key={`${i}-${word}`}
                                style={{
                                  color: i <= currentWordIndex ? captionTextColor : undefined,
                                  opacity: i <= currentWordIndex ? 1 : 0.4,
                                  backgroundColor: i === currentWordIndex ? "rgba(250, 204, 21, 0.45)" : undefined,
                                  padding: i === currentWordIndex ? "0 2px" : undefined,
                                  borderRadius: i === currentWordIndex ? 2 : undefined,
                                }}
                              >
                                {word}
                              </span>
                            ))
                          )}
                        </p>
                      );
                    })() : (
                    <p
                      key={activeCaption.id}
                      className={`max-w-full font-bold text-center ${
                        captionBackground === "pill"
                          ? "bg-background/80 px-4 py-2 rounded-lg"
                          : captionBackground === "bar"
                            ? "bg-background/80 px-4 py-2 w-full rounded-none"
                            : "px-1 py-0.5"
                      } ${
                        captionAnimation === "fadeIn"
                          ? "caption-animate-fade-in"
                          : captionAnimation === "slideUp"
                            ? "caption-animate-slide-up"
                            : captionAnimation === "pop"
                              ? "caption-animate-pop"
                              : ""
                      }`}
                      style={{
                        fontSize: captionFontSize === "small" ? 18 : captionFontSize === "large" ? 28 : 22,
                        color: captionTextColor,
                        textShadow: captionBackground === "none" ? "2px 2px 4px rgba(0,0,0,0.9)" : "1px 1px 2px rgba(0,0,0,0.6)",
                      }}
                    >
                      {stripSpeakerPrefix(activeCaption.text) || activeCaption.text}
                    </p>
                    )}
                  </div>
                </div>
              </>
            )}
            {(voiceoverUrl || hasPerClipAudio) && (
              <audio
                ref={audioRef}
                src={playbackSrc}
                onTimeUpdate={onTimeUpdate}
                onDurationChange={onDurationChange}
                onPlay={onPlay}
                onPause={onPause}
                onEnded={onPlaybackEnded}
                preload="auto"
                crossOrigin="anonymous"
                className="hidden"
              />
            )}
            {musicUrl && (
              <audio
                ref={musicRef}
                src={musicUrl}
                preload="metadata"
                className="hidden"
              />
            )}
          </div>
          </div>

          {/* Properties panel: inline, always visible */}
          <div className="w-72 shrink-0 border-l border-[#2a2a2a] bg-[#1a1a1a] overflow-y-auto flex flex-col">
            {/* Script selector at top of properties panel */}
            <div className="px-4 pt-4 pb-3 border-b border-[#2a2a2a]">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[#a0a0a0]">Script</span>
                <select
                  className="rounded border border-[#2a2a2a] bg-[#0f0f0f] text-white px-3 py-1.5 text-sm"
                  value={scriptId ?? ""}
                  onChange={(e) => setScriptId(e.target.value || undefined)}
                >
                  <option value="">Select a script</option>
                  {savedScripts.length > 0 && (
                    <optgroup label="From Coach">
                      {savedScripts.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {scripts.length > 0 && (
                    <optgroup label="Library">
                      {scripts.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </label>
              {!scriptName && savedScripts.length === 0 && scripts.length === 0 && (
                <p className="text-xs text-[#a0a0a0] mt-2">No scripts yet — use a template below or create one in AI Coach</p>
              )}
            </div>

            {/* Export status */}
            {(isExporting || compileLoading) && (
              <div className="px-4 py-3 border-b border-[#2a2a2a]">
                {isExporting && (
                  <>
                    <p className="text-sm text-[#a0a0a0] mb-1">Exporting...</p>
                    <div className="h-1.5 w-full rounded-full bg-[#2a2a2a] overflow-hidden">
                      <div
                        className="h-full bg-[#f97316] transition-[width] duration-300"
                        style={{ width: `${exportProgress}%` }}
                      />
                    </div>
                  </>
                )}
                {compileLoading && (
                  <p className="text-sm text-[#a0a0a0] flex items-center gap-2" role="status">
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    Compiling… (images + voiceover → 1080p MP4)
                  </p>
                )}
              </div>
            )}
            {compileError && !compileLoading && (
              <div className="px-4 py-2 border-b border-[#2a2a2a]">
                <p className="text-xs text-red-400">{compileError}</p>
              </div>
            )}
            {compileDownloadUrl && !compileLoading && (
              <div className="px-4 py-2 border-b border-[#2a2a2a]">
                <a
                  href={compileDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#f97316] hover:underline"
                >
                  Download MP4
                </a>
              </div>
            )}

            {/* Scene / Caption edit panel content */}
            <div className="flex flex-col flex-1 p-4">
            {selectedCaptionId !== null && selectedCaption ? (
              <>
                <h2 className="text-base font-semibold text-white mb-4">Edit Caption</h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-[#a0a0a0] block mb-1.5">Text</label>
                    <input
                      type="text"
                      className="w-full rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white"
                      value={selectedCaption.text}
                      onChange={(e) => updateCaption(selectedCaption.id, { text: e.target.value })}
                      placeholder="Enter caption text..."
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#a0a0a0] block mb-1.5">Start time (seconds)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      className="w-full rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white tabular-nums"
                      value={selectedCaption.startTime.toFixed(1)}
                      onChange={(e) => {
                        const start = parseFloat(e.target.value);
                        if (!Number.isFinite(start) || start < 0) return;
                        const dur = selectedCaption.endTime - selectedCaption.startTime;
                        updateCaption(selectedCaption.id, { startTime: start, endTime: start + dur });
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#a0a0a0] block mb-1.5">
                      Duration {(selectedCaption.endTime - selectedCaption.startTime).toFixed(1)}s
                    </label>
                    <input
                      type="range"
                      min={0.5}
                      max={10}
                      step={0.1}
                      className="w-full h-2 rounded-lg appearance-none bg-[#2a2a2a] accent-[#f97316]"
                      value={selectedCaption.endTime - selectedCaption.startTime}
                      onChange={(e) => {
                        const dur = parseFloat(e.target.value);
                        updateCaption(selectedCaption.id, { endTime: selectedCaption.startTime + dur });
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#a0a0a0] block mb-1.5">Position</label>
                    <select
                      className="w-full rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white"
                      value={captionPosition}
                      onChange={(e) =>
                        setCaptionPosition(e.target.value as "bottom" | "middle" | "top")
                      }
                    >
                      <option value="bottom">Bottom</option>
                      <option value="middle">Middle</option>
                      <option value="top">Top</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#a0a0a0] block mb-1.5">Font size</label>
                    <select
                      className="w-full rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white"
                      value={captionFontSize}
                      onChange={(e) =>
                        setCaptionFontSize(e.target.value as "small" | "medium" | "large")
                      }
                    >
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                      <option value="large">Large</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#a0a0a0] block mb-1.5">Background</label>
                    <select
                      className="w-full rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white"
                      value={captionBackground}
                      onChange={(e) =>
                        setCaptionBackground(e.target.value as "none" | "pill" | "bar")
                      }
                    >
                      <option value="none">No box (text only)</option>
                      <option value="pill">Pill (rounded box)</option>
                      <option value="bar">Full bar</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#a0a0a0] block mb-1.5">Text colour</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        className="h-9 w-14 cursor-pointer rounded border border-[#2a2a2a] bg-[#0f0f0f] p-1"
                        value={captionTextColor}
                        onChange={(e) => setCaptionTextColor(e.target.value)}
                      />
                      <span className="text-xs text-[#a0a0a0] tabular-nums">{captionTextColor}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="w-full rounded border border-red-800/50 bg-red-900/20 px-3 py-2 text-sm text-red-400 hover:bg-red-900/30"
                    onClick={() => deleteCaption(selectedCaption.id)}
                  >
                    Delete caption
                  </button>
                </div>
              </>
            ) : selectedSceneIndex !== null ? (
              <>
                <input
                  ref={sceneElementFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    const target = imageUploadTargetRef.current;
                    e.target.value = "";
                    if (!file || !target) return;
                    const { sceneIndex, elementIndex } = target;
                    imageUploadTargetRef.current = null;
                    const scene = scenes[sceneIndex];
                    const el = scene?.elements[elementIndex];
                    if (isImageEl(el)) {
                      const prev = el.media?.url;
                      if (prev) URL.revokeObjectURL(prev);
                      updateSceneElement(sceneIndex, elementIndex, { media: { url: URL.createObjectURL(file) } });
                    } else if (isStickerEl(el)) {
                      const prev = el.media?.url;
                      if (prev) URL.revokeObjectURL(prev);
                      updateSceneElement(sceneIndex, elementIndex, { media: { url: URL.createObjectURL(file) } });
                    }
                  }}
                />
                <div className="flex items-center justify-between gap-2 mb-4">
                  <h2 className="text-base font-semibold text-white break-words">
                    {scenes[selectedSceneIndex]?.title ?? "—"}
                  </h2>
                  <button
                    type="button"
                    className="shrink-0 rounded border border-red-800/50 bg-red-900/20 px-2 py-1 text-xs text-red-400 hover:bg-red-900/30"
                    onClick={() => selectedSceneIndex !== null && deleteScene(selectedSceneIndex)}
                  >
                    Delete
                  </button>
                </div>

                <div className="mb-4">
                  <label className="text-xs font-medium text-[#a0a0a0] block mb-1.5">Transition between scenes</label>
                  <select
                    className="w-full rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white"
                    value={sceneTransitionType}
                    onChange={(e) => setSceneTransitionType(e.target.value as SceneTransitionType)}
                  >
                    <optgroup label="Basic">
                      <option value="fade">Fade</option>
                      <option value="wipe">Wipe</option>
                    </optgroup>
                    <optgroup label="Slide">
                      <option value="slideLeft">Slide Left</option>
                      <option value="slideRight">Slide Right</option>
                      <option value="pushUp">Push Up</option>
                      <option value="pushDown">Push Down</option>
                    </optgroup>
                    <optgroup label="Dynamic">
                      <option value="zoom">Zoom</option>
                      <option value="blur">Blur</option>
                      <option value="spin">Spin</option>
                      <option value="flip">Flip</option>
                    </optgroup>
                  </select>
                </div>

                {selectedSceneIndex !== null && (
                  <div className="mb-4">
                    <label className="text-xs font-medium text-[#a0a0a0] block mb-1.5">Duration (seconds)</label>
                    <input
                      type="number"
                      min={0.5}
                      max={600}
                      step={0.1}
                      className="w-full rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white tabular-nums"
                      value={editingDurationInput}
                      onChange={(e) => setEditingDurationInput(e.target.value)}
                      onBlur={() => {
                        const v = parseFloat(editingDurationInput);
                        if (Number.isFinite(v) && v >= 0.5) {
                          updateSceneDuration(selectedSceneIndex, v);
                          setEditingDurationInput(String(v));
                        } else if (selectedSceneDuration !== null) {
                          setEditingDurationInput(String(selectedSceneDuration));
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.currentTarget.blur();
                        }
                      }}
                      placeholder="e.g. 3.5, 7, 10"
                    />
                  </div>
                )}

                {selectedSceneIndex !== null && scenes[selectedSceneIndex]?.animationType && (
                  <div className="mb-4">
                    <label className="text-xs font-medium text-[#a0a0a0] block mb-1.5">Animation</label>
                    <p className="text-sm text-white">{scenes[selectedSceneIndex].animationType}</p>
                  </div>
                )}

                <div className="mb-4">
                  <span className="text-xs font-medium text-[#a0a0a0] block mb-2">Background media</span>
                  <input
                    ref={sceneMediaInputRef}
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && selectedSceneIndex !== null) handleSceneMediaFile(file, selectedSceneIndex);
                      e.target.value = "";
                    }}
                  />
                  {(() => {
                  const bgMedia = selectedSceneIndex !== null ? getSceneBackgroundMedia(scenes[selectedSceneIndex]) : null;
                  return bgMedia ? (
                    <div className="relative rounded-lg border border-[#2a2a2a] overflow-hidden bg-[#0f0f0f] aspect-video">
                      {bgMedia.type === "image" ? (
                        <img
                          src={bgMedia.url}
                          alt="Scene background"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <video
                          src={bgMedia.url}
                          className="w-full h-full object-contain"
                          muted
                          playsInline
                          preload="metadata"
                        />
                      )}
                      <button
                        type="button"
                        className="absolute bottom-2 right-2 rounded bg-[#0f0f0f]/90 px-2 py-1 text-xs text-white border border-[#2a2a2a] hover:bg-[#1a1a1a]"
                        onClick={() => {
                          const scene = scenes[selectedSceneIndex!];
                          const first = scene?.elements[0];
                          if (first && isBackgroundEl(first) && first.media?.url) {
                            URL.revokeObjectURL(first.media.url);
                            updateSceneElement(selectedSceneIndex!, 0, { media: null });
                          }
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div
                      className="rounded-lg border-2 border-dashed border-[#2a2a2a] bg-[#0f0f0f] aspect-video flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-[#1a1a1a] transition-colors min-h-[120px]"
                      onClick={() => sceneMediaInputRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.currentTarget.classList.add("border-[#f97316]/50");
                      }}
                      onDragLeave={(e) => {
                        e.currentTarget.classList.remove("border-[#f97316]/50");
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.currentTarget.classList.remove("border-[#f97316]/50");
                        const file = e.dataTransfer.files?.[0];
                        if (file && selectedSceneIndex !== null && (file.type.startsWith("image/") || file.type.startsWith("video/"))) {
                          handleSceneMediaFile(file, selectedSceneIndex);
                        }
                      }}
                    >
                      <span className="text-sm text-[#a0a0a0]">Drop image or video here</span>
                      <button
                        type="button"
                        className="rounded bg-[#f97316] px-3 py-1.5 text-sm text-white hover:bg-orange-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          sceneMediaInputRef.current?.click();
                        }}
                      >
                        Browse
                      </button>
                    </div>
                  );
                  })()}
                </div>

                <div className="mb-4">
                  <label className="text-xs font-medium text-[#a0a0a0] block mb-2">Scene text</label>
                  <textarea
                    className="w-full min-h-[100px] rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-3 text-sm text-white placeholder:text-[#a0a0a0] focus:outline-none focus:ring-1 focus:ring-[#f97316] leading-relaxed resize-y"
                    value={scenes[selectedSceneIndex]?.title ?? ""}
                    onChange={(e) => {
                      const i = selectedSceneIndex;
                      if (i === null) return;
                      const value = e.target.value;
                      setScenes((prev) =>
                        prev.map((s, idx) => (idx === i ? { ...s, title: value } : s))
                      );
                    }}
                    placeholder="Enter scene text..."
                  />
                </div>

                <div className="mt-3 border-t border-[#2a2a2a] pt-3 mb-4">
                  <h3 className="font-bold text-white mb-2 text-sm">Overlays</h3>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => addElement("text")}
                      className="rounded border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-1.5 text-sm text-white hover:bg-[#2a2a2a]"
                    >
                      Add Text
                    </button>
                    <button
                      type="button"
                      onClick={() => addElement("image")}
                      className="rounded border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-1.5 text-sm text-white hover:bg-[#2a2a2a]"
                    >
                      Add Image
                    </button>
                  </div>
                  <div className="space-y-3 max-h-[200px] overflow-y-auto">
                    {(scenes[selectedSceneIndex]?.elements ?? []).map((el, elementIndex) => {
                      const positionY = "position" in el && el.position ? el.position.y : 50;
                      const verticalPreset = positionY <= 25 ? "top" : positionY >= 75 ? "bottom" : "middle";
                      const setVertical = (preset: "top" | "middle" | "bottom") => {
                        const y = preset === "top" ? 15 : preset === "bottom" ? 85 : 50;
                        updateSceneElement(selectedSceneIndex!, elementIndex, {
                          position: { ...("position" in el ? el.position : { x: 50, y: 50 }), y },
                        });
                      };
                      return (
                      <div key={el.id} className="rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] p-2 text-xs space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-white capitalize">{el.type}</span>
                          <div className="flex items-center gap-1">
                            {elementIndex > 1 && (
                              <button
                                type="button"
                                className="rounded border border-[#2a2a2a] px-1.5 py-0.5 text-[#a0a0a0] hover:bg-[#2a2a2a] hover:text-white"
                                onClick={() => moveSceneElement(selectedSceneIndex!, elementIndex, "back")}
                              >
                                Back
                              </button>
                            )}
                            {elementIndex < (scenes[selectedSceneIndex]?.elements?.length ?? 0) - 1 && (
                              <button
                                type="button"
                                className="rounded border border-[#2a2a2a] px-1.5 py-0.5 text-[#a0a0a0] hover:bg-[#2a2a2a] hover:text-white"
                                onClick={() => moveSceneElement(selectedSceneIndex!, elementIndex, "front")}
                              >
                                Front
                              </button>
                            )}
                            {!isBackgroundEl(el) && (
                              <button
                                type="button"
                                className="rounded border border-red-800/50 text-red-400 px-1.5 py-0.5 hover:bg-red-900/20"
                                onClick={() => removeElement(elementIndex)}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                        {isTextEl(el) && (
                          <>
                            <input
                              type="text"
                              className="w-full mt-2 rounded border border-[#2a2a2a] bg-[#1a1a1a] px-2 py-1 text-sm text-white"
                              value={el.content}
                              onChange={(e) => updateElement(elementIndex, { content: e.target.value })}
                              placeholder="Enter text"
                            />
                            <div>
                              <span className="text-[#a0a0a0] block mb-1">Position</span>
                              <div className="flex gap-1">
                                {(["top", "middle", "bottom"] as const).map((p) => (
                                  <button
                                    key={p}
                                    type="button"
                                    className={`rounded border px-2 py-1 capitalize ${verticalPreset === p ? "bg-[#f97316] text-white border-[#f97316]" : "border-[#2a2a2a] bg-[#0f0f0f] text-[#a0a0a0] hover:bg-[#2a2a2a]"}`}
                                    onClick={() => setVertical(p)}
                                  >
                                    {p}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <label className="flex items-center gap-1 text-[#a0a0a0]">
                                <span>Size</span>
                                <input
                                  type="number"
                                  className="w-14 rounded border border-[#2a2a2a] bg-[#1a1a1a] text-white px-1 py-0.5 tabular-nums"
                                  value={el.fontSize}
                                  onChange={(e) =>
                                    updateSceneElement(selectedSceneIndex!, elementIndex, {
                                      fontSize: Number(e.target.value),
                                    })
                                  }
                                />
                              </label>
                              <div className="flex items-center gap-1 text-[#a0a0a0]">
                                <span>Color</span>
                                <input
                                  type="color"
                                  className="h-6 w-8 cursor-pointer rounded border border-[#2a2a2a]"
                                  value={el.color}
                                  onChange={(e) =>
                                    updateSceneElement(selectedSceneIndex!, elementIndex, { color: e.target.value })
                                  }
                                />
                              </div>
                            </div>
                          </>
                        )}
                        {isImageEl(el) && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              {el.media?.url && (
                                <img src={el.media.url} alt="" className="h-10 w-10 rounded border border-[#2a2a2a] object-cover" />
                              )}
                              <button
                                type="button"
                                className="rounded border border-[#2a2a2a] bg-[#0f0f0f] text-white px-2 py-1 text-xs hover:bg-[#2a2a2a]"
                                onClick={() => {
                                  imageUploadTargetRef.current = { sceneIndex: selectedSceneIndex!, elementIndex };
                                  sceneElementFileInputRef.current?.click();
                                }}
                              >
                                {el.media?.url ? "Replace image" : "Upload image"}
                              </button>
                            </div>
                            <div>
                              <span className="text-[#a0a0a0] block mb-1">Position</span>
                              <div className="flex gap-1">
                                {(["top", "middle", "bottom"] as const).map((p) => (
                                  <button
                                    key={p}
                                    type="button"
                                    className={`rounded border px-2 py-1 capitalize ${verticalPreset === p ? "bg-[#f97316] text-white border-[#f97316]" : "border-[#2a2a2a] bg-[#0f0f0f] text-[#a0a0a0] hover:bg-[#2a2a2a]"}`}
                                    onClick={() => setVertical(p)}
                                  >
                                    {p}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="number"
                                className="w-14 rounded border border-[#2a2a2a] bg-[#1a1a1a] text-white px-1 py-0.5 tabular-nums"
                                placeholder="W"
                                value={el.size.w}
                                onChange={(e) =>
                                  updateSceneElement(selectedSceneIndex!, elementIndex, {
                                    size: { ...el.size, w: Number(e.target.value) },
                                  })
                                }
                              />
                              <input
                                type="number"
                                className="w-14 rounded border border-[#2a2a2a] bg-[#1a1a1a] text-white px-1 py-0.5 tabular-nums"
                                placeholder="H"
                                value={el.size.h}
                                onChange={(e) =>
                                  updateSceneElement(selectedSceneIndex!, elementIndex, {
                                    size: { ...el.size, h: Number(e.target.value) },
                                  })
                                }
                              />
                            </div>
                          </div>
                        )}
                        {isGraphicEl(el) && (
                          <p className="text-[#a0a0a0] text-xs">Graphic. Use Delete to remove.</p>
                        )}
                        {isStickerEl(el) && (
                          <p className="text-[#a0a0a0] text-xs">Sticker. Use Delete to remove.</p>
                        )}
                      </div>
                      );
                    })}
                  </div>
                </div>

                {selectedSceneDuration !== null && (
                  <div className="mt-auto pt-3 border-t border-[#2a2a2a]">
                    <span className="text-xs font-medium text-[#a0a0a0] block mb-1">Duration</span>
                    <p className="text-sm text-white tabular-nums">
                      {selectedSceneDuration.toFixed(1)}s
                    </p>
                  </div>
                )}

                {/* Music - always visible */}
                <div className="mt-4 pt-4 border-t border-[#2a2a2a] space-y-3">
                  <h3 className="text-sm font-semibold text-white">Music</h3>
                  <div>
                    <label className="text-xs font-medium text-[#a0a0a0] block mb-1.5">
                      Volume {musicUrl ? `${musicVolume}%` : ""}
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={musicVolume}
                      onChange={(e) => setMusicVolume(Number(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none bg-[#2a2a2a] accent-[#f97316]"
                      disabled={!musicUrl}
                      title="Music volume"
                    />
                  </div>
                </div>

                {/* Subtitles */}
                <div className="mt-4 pt-4 border-t border-[#2a2a2a] space-y-3">
                  <h3 className="text-sm font-semibold text-white">Subtitles</h3>
                  <p className="text-xs text-[#a0a0a0]">
                    Generate timed captions from voiceover or export as SRT.
                  </p>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      className="w-full rounded-md border border-[#f97316]/40 bg-[#f97316]/10 px-3 py-2 text-sm font-medium text-white hover:bg-[#f97316]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={handleGenerateSubtitlesFromVoiceover}
                      disabled={transcribeLoading || !voiceoverUrl}
                      title={voiceoverUrl ? "Generate subtitles from voiceover (Whisper)" : "Add a voiceover first"}
                    >
                      {transcribeLoading ? "Generating…" : "Generate from voiceover"}
                    </button>
                    {transcribeError && (
                      <p className="text-xs text-red-400" title={transcribeError}>
                        {transcribeError}
                      </p>
                    )}
                    <button
                      type="button"
                      className="w-full rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white hover:bg-[#2a2a2a] disabled:opacity-50"
                      onClick={handleExportSrt}
                      disabled={captions.length === 0}
                    >
                      Export SRT ({captions.length} caption{captions.length !== 1 ? "s" : ""})
                    </button>
                  </div>
                </div>

                {/* Additional actions */}
                <div className="mt-4 pt-4 border-t border-[#2a2a2a] space-y-2">
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      className="w-full rounded border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-1.5 text-sm text-white hover:bg-[#2a2a2a] disabled:opacity-50"
                      disabled={compileLoading || compileTestLoading}
                      onClick={handleTestCompile}
                    >
                      {compileTestLoading ? <Loader2 className="inline h-4 w-4 animate-spin mr-1" /> : null}
                      Test compile ({scenes.length || 0} scenes)
                    </button>
                    {ffmpegLoadError && (
                      <p className="text-xs text-red-400 text-center">
                        Video engine failed to load ({ffmpegLoadError}).{" "}
                        <button
                          type="button"
                          className="underline font-medium"
                          onClick={() => void initBrowserFFmpeg()}
                        >
                          Retry
                        </button>
                      </p>
                    )}
                    <button
                      type="button"
                      className="w-full rounded border border-green-800/50 bg-green-900/20 px-3 py-1.5 text-sm text-green-400 hover:bg-green-900/30 disabled:opacity-50"
                      disabled={isExporting}
                      onClick={handleSchedule}
                    >
                      📅 Schedule
                    </button>
                    <button
                      type="button"
                      className="w-full rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                      disabled={!ffmpegLoaded || !scriptId || (!voiceoverUrl && !hasPerClipAudio) || isExporting}
                      onClick={() => handleExportVideo()}
                    >
                      📹 Publish Now
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Music - always visible when no scene/caption selected */}
                <div className="mb-4 space-y-3">
                  <h3 className="text-sm font-semibold text-white">Music</h3>
                  <div>
                    <label className="text-xs font-medium text-[#a0a0a0] block mb-1.5">
                      Volume {musicUrl ? `${musicVolume}%` : ""}
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={musicVolume}
                      onChange={(e) => setMusicVolume(Number(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none bg-[#2a2a2a] accent-[#f97316]"
                      disabled={!musicUrl}
                      title="Music volume"
                    />
                  </div>
                </div>
                <p className="text-sm text-[#a0a0a0]">Click a scene or caption to edit it.</p>
              </>
            )}

            {/* Caption Style - always visible */}
            <div className="mt-4 pt-4 border-t border-[#2a2a2a] space-y-3">
              <h3 className="text-sm font-semibold text-white">Caption Style</h3>
              <div>
                <label className="text-xs font-medium text-[#a0a0a0] block mb-1.5">Presets</label>
                <div className="flex flex-wrap gap-1.5">
                  {CAPTION_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      className="rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-2.5 py-1.5 text-xs text-white hover:bg-[#2a2a2a] capitalize"
                      onClick={() => {
                        setCaptionPosition(preset.position);
                        setCaptionFontSize(preset.fontSize);
                        setCaptionTextColor(preset.textColor);
                        setCaptionAnimation(preset.animation);
                        setCaptionBackground(preset.background);
                        setCaptionDisplayMode(preset.displayMode);
                      }}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-[#a0a0a0] block mb-1.5">Background</label>
                <select
                  className="w-full rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white"
                  value={captionBackground}
                  onChange={(e) =>
                    setCaptionBackground(e.target.value as "none" | "pill" | "bar")
                  }
                >
                  <option value="none">No box (text only)</option>
                  <option value="pill">Pill (rounded box)</option>
                  <option value="bar">Full bar</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[#a0a0a0] block mb-1.5">Animation</label>
                <select
                  className="w-full rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white"
                  value={captionAnimation}
                  onChange={(e) =>
                    setCaptionAnimation(e.target.value as "none" | "fadeIn" | "slideUp" | "pop")
                  }
                >
                  <option value="none">None</option>
                  <option value="fadeIn">Fade In</option>
                  <option value="slideUp">Slide Up</option>
                  <option value="pop">Pop (scale in)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[#a0a0a0] block mb-1.5">Position</label>
                <select
                  className="w-full rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white"
                  value={captionPosition}
                  onChange={(e) =>
                    setCaptionPosition(e.target.value as "bottom" | "middle" | "top")
                  }
                >
                  <option value="bottom">Bottom</option>
                  <option value="middle">Middle</option>
                  <option value="top">Top</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[#a0a0a0] block mb-1.5">Font size</label>
                <select
                  className="w-full rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white"
                  value={captionFontSize}
                  onChange={(e) =>
                    setCaptionFontSize(e.target.value as "small" | "medium" | "large")
                  }
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[#a0a0a0] block mb-1.5">Display</label>
                <select
                  className="w-full rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white"
                  value={captionDisplayMode}
                  onChange={(e) =>
                    setCaptionDisplayMode(e.target.value as "full" | "wordByWord" | "singleWord")
                  }
                >
                  <option value="full">Full line (all text at once)</option>
                  <option value="wordByWord">Word by word (build up + highlight)</option>
                  <option value="singleWord">Single word only (one word on screen)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[#a0a0a0] block mb-1.5">Text colour</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="h-9 w-14 cursor-pointer rounded border border-[#2a2a2a] bg-[#0f0f0f] p-1"
                    value={captionTextColor}
                    onChange={(e) => setCaptionTextColor(e.target.value)}
                    title="Caption text colour"
                  />
                  <span className="text-xs text-[#a0a0a0] tabular-nums">{captionTextColor}</span>
                </div>
              </div>
            </div>
            </div>

          </div>{/* end properties panel */}
        </div>{/* end middle row */}

        {/* BOTTOM: playback controls + timeline */}
        <div className="shrink-0 border-t border-[#2a2a2a] bg-[#111111] flex flex-col">
          {/* Playback controls row */}
          <div className="flex items-center gap-2 px-3 h-10 border-b border-[#2a2a2a] shrink-0">
            <button
              type="button"
              className="p-1 rounded text-[#a0a0a0] hover:bg-[#2a2a2a] hover:text-white disabled:opacity-40 transition-colors"
              onClick={() => { if (audioRef.current) { audioRef.current.currentTime = 0; } }}
              title="Skip to start"
              aria-label="Skip to start"
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="p-1.5 rounded bg-white/10 hover:bg-white/20 text-white disabled:opacity-50 transition-colors"
              onClick={isPlaying ? pause : play}
              disabled={(!voiceoverUrl && !hasPerClipAudio) || isExporting}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              type="button"
              className="p-1 rounded text-[#a0a0a0] hover:bg-[#2a2a2a] hover:text-white disabled:opacity-40 transition-colors"
              onClick={() => { if (audioRef.current) { audioRef.current.currentTime = audioRef.current.duration || 0; } }}
              title="Skip to end"
              aria-label="Skip to end"
            >
              <SkipForward className="h-4 w-4" />
            </button>
            <span className="text-xs text-[#a0a0a0] tabular-nums ml-1">
              {formatTime(currentTime)} / {formatTime(Math.max(duration, voiceoverDuration))}
            </span>
            <div className="w-px h-4 bg-[#2a2a2a] mx-1" />
            <button
              type="button"
              className="p-1 rounded text-[#a0a0a0] hover:bg-[#2a2a2a] hover:text-white"
              onClick={handleZoomOut}
              title="Zoom out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs text-[#a0a0a0] tabular-nums w-10 text-center">{Math.round(zoomLevel * 100)}%</span>
            <button
              type="button"
              className="p-1 rounded text-[#a0a0a0] hover:bg-[#2a2a2a] hover:text-white"
              onClick={handleZoomIn}
              title="Zoom in"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="p-1 rounded text-[#a0a0a0] hover:bg-[#2a2a2a] hover:text-white"
              onClick={handleFitToScreen}
              title="Fit to screen"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <div className="w-px h-4 bg-[#2a2a2a] mx-1" />
            <button
              type="button"
              onClick={addScene}
              className="px-2 py-0.5 text-[#a0a0a0] hover:text-white text-xs rounded hover:bg-[#2a2a2a] transition-colors"
              title="Add scene"
            >
              + Scene
            </button>
            <button
              type="button"
              onClick={handleAutoSyncToVoiceover}
              className="px-2 py-0.5 text-[#a0a0a0] hover:text-white text-xs rounded hover:bg-[#2a2a2a] transition-colors"
              title="Snap scene blocks to equal voiceover segments"
            >
              Sync
            </button>
            <button
              type="button"
              onClick={handleCompactScenes}
              className="px-2 py-0.5 text-[#a0a0a0] hover:text-white text-xs rounded hover:bg-[#2a2a2a] transition-colors"
              title="Remove gaps between scenes"
            >
              Remove gaps
            </button>
            <button
              type="button"
              onClick={handleSplitScene}
              disabled={selectedSceneIndex == null || (() => {
                const b = selectedSceneIndex != null ? sceneBlocks.find((x) => scenes[selectedSceneIndex]?.id === x.id) : null;
                return !b || currentTime <= b.startTime || currentTime >= b.endTime || b.endTime - currentTime < 0.5 || currentTime - b.startTime < 0.5;
              })()}
              className="px-2 py-0.5 text-[#a0a0a0] hover:text-white text-xs rounded hover:bg-[#2a2a2a] disabled:opacity-40 transition-colors"
              title="Split selected scene at playhead"
            >
              Split
            </button>
            <div className="flex-1" />
            <span className="text-[10px] text-[#a0a0a0]/60 hidden sm:block">Space · Cmd+Z · Cmd+Shift+Z</span>
          </div>

          {/* Timeline tracks */}
          <div className="flex min-h-0 overflow-hidden" style={{ height: 176 }}>
          <div
            ref={scrollContainerRef}
            className={`timeline-horizontal-scroll timeline-scroll flex min-h-[200px] min-w-0 flex-1 overflow-x-auto overflow-y-hidden ${isPanning ? "cursor-grabbing" : "cursor-grab"}`}
            style={{
              width: "100%",
              overflowX: "scroll",
              WebkitOverflowScrolling: "touch",
              scrollbarWidth: "auto",
              scrollbarColor: "#888 #e5e7eb",
            }}
            onWheel={handleTimelineWheel}
            onPointerDown={handleTimelinePanStart}
            onScroll={() => {
              const el = scrollContainerRef.current;
              if (el) setScrollState({ scrollLeft: el.scrollLeft, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth });
            }}
          >
            <div className="shrink-0 w-28 border-r border-[#2a2a2a] bg-[#1a1a1a] flex flex-col text-xs text-[#a0a0a0]">
              <div className="shrink-0 border-b border-[#2a2a2a]" style={{ height: RULER_HEIGHT }} />
              <div className="flex-1 flex flex-col">
                <div className="flex items-center gap-1.5 px-2 border-b border-[#2a2a2a] shrink-0" style={{ height: 64 }}>
                  <Film className="h-3 w-3 shrink-0 text-[#a0a0a0]" />
                  <span className="font-medium text-white shrink-0 leading-tight text-[11px]">Scenes</span>
                </div>
                <div className="shrink-0 px-2 flex items-center gap-1.5 border-b border-[#2a2a2a]" style={{ height: TRACK_HEIGHT }}>
                  <Mic className="h-3 w-3 shrink-0 text-[#a0a0a0]" />
                  <span className="font-medium text-white text-[11px]">Voice</span>
                </div>
                <div className="shrink-0 px-2 flex items-center gap-1.5 border-b border-[#2a2a2a]" style={{ height: TRACK_HEIGHT }}>
                  <Type className="h-3 w-3 shrink-0 text-[#a0a0a0]" />
                  <span className="font-medium text-white text-[11px]">Captions</span>
                </div>
                <div className="shrink-0 px-2 flex items-center gap-1.5" style={{ height: TRACK_HEIGHT }}>
                  <Music2 className="h-3 w-3 shrink-0 text-[#a0a0a0]" />
                  <span className="font-medium text-white text-[11px]">Music</span>
                </div>
              </div>
            </div>
            <div
              ref={timelineRef}
              className="relative shrink-0 overflow-y-hidden timeline-inner bg-[#111111]"
              style={{ minWidth: timelineWidth, width: timelineWidth }}
              onClick={(e) => { setTransitionBadgeOpen(null); handleTimelineClick(e); }}
            >
              {/* Ruler: every 1s for videos under 30s, every 5s for longer */}
              <div
                className="sticky top-0 z-10 border-b border-[#2a2a2a] bg-[#1a1a1a] text-xs text-[#a0a0a0]"
                style={{ height: RULER_HEIGHT, width: timelineWidth }}
              >
                {(() => {
                  const step = effectiveDuration <= 30 ? 1 : 5;
                  const count = Math.ceil(effectiveDuration / step) + 1;
                  return Array.from({ length: count }, (_, i) => {
                    const sec = i * step;
                    return (
                      <div
                        key={i}
                        className="absolute border-l border-[#2a2a2a] pl-1.5 min-w-[2rem]"
                        style={{ left: timeToX(sec) }}
                      >
                        {sec}s
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Tracks content */}
              <div style={{ width: timelineWidth, minWidth: timelineWidth }}>
                <div
                  className="relative border-b border-[#2a2a2a]"
                  style={{
                    minHeight: expandedSceneIndex !== null ? 96 : 64,
                    height: expandedSceneIndex !== null ? 96 : 64,
                    width: timelineWidth,
                  }}
                >
                  {sceneBlocks.map((block) => {
                    const sceneIndex = scenes.findIndex((s) => s.id === block.id);
                    return (
                      <EditableSceneBlock
                        key={block.id}
                        block={block}
                        sceneIndex={sceneIndex >= 0 ? sceneIndex : 0}
                        isSelected={selectedSceneIndex === sceneIndex}
                        onSelect={() => {
                          if (sceneIndex >= 0) {
                            setSelectedSceneIndex(sceneIndex);
                            setSelectedCaptionId(null);
                            setRightPanelOpen(true);
                          }
                        }}
                        expanded={expandedSceneIndex === sceneIndex}
                        onToggleExpand={() => setExpandedSceneIndex((prev) => (prev === sceneIndex ? null : sceneIndex))}
                        durationSec={block.endTime - block.startTime}
                        thumbnailUrl={sceneIndex >= 0 && scenes[sceneIndex] ? getSceneBackgroundMedia(scenes[sceneIndex])?.url ?? null : null}
                        timeToX={timeToX}
                        xToTime={xToTime}
                        effectiveDuration={effectiveDuration}
                        updateSceneTiming={updateSceneTiming}
                        onTimingChangeComplete={pushUndoSnapshot}
                        otherBlocks={sceneBlocks.filter((b) => b.id !== block.id)}
                        onDropFile={(file) => {
                          if (sceneIndex >= 0) handleSceneMediaFile(file, sceneIndex);
                        }}
                        onSetMedia={(url, type) => {
                          if (sceneIndex >= 0) {
                            setScenes((prev) => prev.map((s, si) => si !== sceneIndex ? s : {
                              ...s,
                              elements: s.elements.map((el, ei) => ei === 0 ? { ...el, media: { url, type } } : el),
                            }));
                          }
                        }}
                      />
                    );
                  })}
                  {/* Transition badges between clips */}
                  {(() => {
                    const sorted = [...sceneBlocks].sort((a, b) => a.startTime - b.startTime);
                    return sorted.slice(0, -1).map((block, i) => {
                      const x = timeToX(block.endTime);
                      const label = TRANSITION_LABELS[sceneTransitionType] ?? sceneTransitionType;
                      const isOpen = transitionBadgeOpen === i;
                      const TRANSITION_OPTIONS: Array<{ value: string; label: string }> = [
                        { value: "fade", label: "Fade" },
                        { value: "slideLeft", label: "◀ Slide Left" },
                        { value: "slideRight", label: "▶ Slide Right" },
                        { value: "wipe", label: "Wipe" },
                        { value: "pushUp", label: "▲ Push Up" },
                        { value: "pushDown", label: "▼ Push Down" },
                        { value: "zoom", label: "Zoom" },
                        { value: "blur", label: "Blur" },
                        { value: "spin", label: "↻ Spin" },
                        { value: "flip", label: "⇄ Flip" },
                      ];
                      return (
                        <div
                          key={`tx-${block.id}`}
                          className="absolute z-30"
                          style={{ left: x - 14, top: "50%", transform: "translateY(-50%)" }}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isOpen) {
                                setTransitionBadgeOpen(null);
                                setTransitionBadgePos(null);
                              } else {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setTransitionBadgePos({ x: rect.left + rect.width / 2, y: rect.top });
                                setTransitionBadgeOpen(i);
                              }
                            }}
                            className="w-7 h-7 rounded-full bg-[#1a1a1a] border-2 border-[#f97316] text-[9px] font-bold text-[#f97316] flex items-center justify-center shadow-lg hover:bg-[#f97316] hover:text-white transition-colors"
                            title={`Transition: ${sceneTransitionType}`}
                          >
                            {label.length <= 2 ? label : label.slice(0, 1).toUpperCase()}
                          </button>
                        </div>
                      );
                    });
                  })()}
                </div>
                <div
                  className="relative border-b border-[#2a2a2a]"
                  style={{ height: TRACK_HEIGHT }}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('ring-1', 'ring-[#f97316]'); }}
                  onDragLeave={(e) => { e.currentTarget.classList.remove('ring-1', 'ring-[#f97316]'); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('ring-1', 'ring-[#f97316]');
                    const file = e.dataTransfer.files?.[0];
                    if (!file || !file.type.startsWith('audio/')) return;
                    const prevUrl = voiceoverUrl;
                    if (prevUrl && voiceoverFileName) URL.revokeObjectURL(prevUrl);
                    setVoiceoverUrl(URL.createObjectURL(file));
                    setVoiceoverFileName(file.name);
                    const audio = new Audio(URL.createObjectURL(file));
                    audio.addEventListener('loadedmetadata', () => setVoiceoverDuration(audio.duration), { once: true });
                    setCaptions([]);
                  }}
                >
                  <input
                    ref={voiceoverInputRef}
                    type="file"
                    accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/x-m4a"
                    className="hidden"
                    onChange={handleVoiceoverUpload}
                  />
                  {voiceoverUrl ? (
                    <>
                      {effectiveDuration > 0 &&
                        sceneBlocks.map((scene, index) => {
                          const sceneColor = SCENE_COLOR_HEX[index % SCENE_COLOR_HEX.length] ?? DEFAULT_SCENE_COLOR;
                          const left = timeToX(scene.startTime);
                          const width = Math.max(2, timeToX(scene.endTime) - timeToX(scene.startTime));
                          return (
                            <div
                              key={scene.id}
                              className="absolute top-1.5 bottom-1.5 rounded flex items-center overflow-hidden min-w-0"
                              style={{
                                left,
                                width,
                                backgroundColor: sceneColor,
                                opacity: 0.85,
                              }}
                            >
                              <span className="text-white text-[11px] px-1.5 truncate pointer-events-none min-w-0">
                                Voiceover {index + 1}
                              </span>
                            </div>
                          );
                        })}
                      <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10 flex items-center gap-2 text-xs text-white">
                        <span className="truncate max-w-[140px]" title={voiceoverFileName ?? undefined}>
                          {voiceoverFileName ?? "Voiceover"}
                        </span>
                        {duration > 0 && (
                          <span className="text-[#a0a0a0] tabular-nums shrink-0">
                            {formatTime(duration)}
                          </span>
                        )}
                        <button
                          type="button"
                          className="shrink-0 rounded border border-[#2a2a2a] bg-[#1a1a1a] px-1.5 py-0.5 text-[#a0a0a0] hover:bg-[#2a2a2a] hover:text-white"
                          onClick={() => voiceoverInputRef.current?.click()}
                        >
                          Replace
                        </button>
                        <button
                          type="button"
                          className="shrink-0 rounded border border-red-800/50 text-red-400 px-1.5 py-0.5 hover:bg-red-900/20"
                          onClick={removeVoiceover}
                        >
                          Remove
                        </button>
                      </div>
                    </>
                  ) : hasPerClipAudio ? (
                    <span
                      className="absolute left-2 top-1/2 -translate-y-1/2 z-10 text-xs text-[#a0a0a0] max-w-[min(280px,85%)] truncate"
                      title="Each scene clip has its own audio from Video Guide / Template Studio"
                    >
                      Per-scene audio on clips (no single master file)
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="absolute left-2 top-1/2 -translate-y-1/2 z-10 rounded border border-dashed border-[#2a2a2a] bg-[#1a1a1a] px-2 py-1 text-xs text-[#a0a0a0] hover:bg-[#2a2a2a] hover:text-white"
                      style={{ minWidth: 200 }}
                      onClick={() => voiceoverInputRef.current?.click()}
                    >
                      🎙 Drop or click to add voiceover
                    </button>
                  )}
                </div>
                <div
                  className="relative border-b border-[#2a2a2a]"
                  style={{
                    height: TRACK_HEIGHT,
                    contain: "paint",
                    transform: "translateZ(0)",
                  }}
                >
                  {effectiveDuration > 0 &&
                    sceneBlocks.map((scene, index) => {
                      const sceneColor = SCENE_COLOR_HEX[index % SCENE_COLOR_HEX.length] ?? DEFAULT_SCENE_COLOR;
                      const left = timeToX(scene.startTime);
                      const width = Math.max(2, timeToX(scene.endTime) - timeToX(scene.startTime));
                      return (
                        <div
                          key={`caption-seg-${scene.id}`}
                          className="absolute top-1.5 bottom-1.5 rounded pointer-events-none"
                          style={{
                            left,
                            width,
                            backgroundColor: sceneColor,
                            opacity: 0.5,
                          }}
                          aria-hidden
                        />
                      );
                    })}
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10 flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded border border-dashed border-[#2a2a2a] bg-[#1a1a1a] px-2 py-1 text-xs text-[#a0a0a0] hover:bg-[#2a2a2a] hover:text-white"
                      onClick={handleAddCaption}
                    >
                      Add Caption
                    </button>
                    <button
                      type="button"
                      className="rounded border border-[#f97316]/40 bg-[#f97316]/10 px-2 py-1 text-xs text-white hover:bg-[#f97316]/20 disabled:opacity-50"
                      onClick={handleGenerateSubtitlesFromVoiceover}
                      disabled={transcribeLoading || !voiceoverUrl}
                      title={voiceoverUrl ? "Generate subtitles from voiceover (speech-to-text)" : "Add a voiceover first"}
                    >
                      {transcribeLoading ? "Generating…" : "Generate from voiceover"}
                    </button>
                  </div>
                  {transcribeError && (
                    <p className="absolute left-2 bottom-0 z-10 text-xs text-destructive max-w-[200px]" title={transcribeError}>
                      {transcribeError}
                    </p>
                  )}
                  {captions.map((cap) => (
                    <div
                      key={cap.id}
                      role="button"
                      tabIndex={0}
                      className={`absolute top-1.5 bottom-1.5 rounded px-1.5 overflow-hidden text-xs text-foreground cursor-pointer z-10 min-w-0 ${
                        selectedCaptionId === cap.id
                          ? "bg-amber-500 ring-2 ring-foreground ring-offset-1 ring-offset-background"
                          : "bg-amber-600/70 hover:bg-amber-600/90"
                      }`}
                      style={{
                        left: timeToX(cap.startTime),
                        width: Math.max(4, timeToX(cap.endTime) - timeToX(cap.startTime)),
                      }}
                      title={cap.text}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCaptionId(cap.id);
                        setSelectedSceneIndex(null);
                      }}
                    >
                      <span className="truncate block">{cap.text || "—"}</span>
                    </div>
                  ))}
                </div>
                <div
                  className="relative"
                  style={{ height: TRACK_HEIGHT }}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('ring-1', 'ring-[#f97316]'); }}
                  onDragLeave={(e) => { e.currentTarget.classList.remove('ring-1', 'ring-[#f97316]'); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('ring-1', 'ring-[#f97316]');
                    const file = e.dataTransfer.files?.[0];
                    if (!file || !file.type.startsWith('audio/')) return;
                    const prev = musicUrl;
                    if (prev) URL.revokeObjectURL(prev);
                    setMusicUrl(URL.createObjectURL(file));
                  }}
                >
                  <input
                    ref={musicInputRef}
                    type="file"
                    accept="audio/mpeg,.mp3"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const prev = musicUrl;
                      if (prev) URL.revokeObjectURL(prev);
                      setMusicUrl(URL.createObjectURL(file));
                      e.target.value = "";
                    }}
                  />
                  {musicUrl && duration > 0 ? (
                    <div
                      className="absolute top-1.5 bottom-1.5 rounded bg-green-600/80 left-0"
                      style={{ width: timelineWidth }}
                      title="Music track"
                    />
                  ) : (
                    <button
                      type="button"
                      className="absolute left-2 top-1/2 -translate-y-1/2 rounded border border-dashed border-[#2a2a2a] bg-[#1a1a1a] px-2 py-1 text-xs text-[#a0a0a0] hover:bg-[#2a2a2a] hover:text-white"
                      onClick={() => musicInputRef.current?.click()}
                    >
                      Add music
                    </button>
                  )}
                </div>

                {/* Add scene at bottom of timeline: 5s, next color, drag to reorder / click to edit duration */}
                <div
                  className="flex items-center justify-center gap-4 border-t border-[#2a2a2a] bg-[#1a1a1a] py-2"
                  style={{ height: TRACK_HEIGHT }}
                >
                  <button
                    type="button"
                    onClick={addScene}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
                  >
                    + Add Scene
                  </button>
                  <span className="text-xs text-[#a0a0a0]">
                    New scene: 5s · Drag to reorder · Click to edit duration
                  </span>
                </div>
              </div>

              {/* Playhead: red line + top indicator */}
              {timelineWidth > 0 && (
                <div
                  data-playhead
                  role="slider"
                  aria-label="Playhead"
                  aria-valuemin={0}
                  aria-valuemax={effectiveDuration}
                  aria-valuenow={currentTime}
                  className="absolute top-0 bottom-0 w-1 cursor-ew-resize z-20 pointer-events-auto"
                  style={{ left: playheadX, backgroundColor: PLAYHEAD_COLOR, boxShadow: "0 0 0 1px rgba(0,0,0,0.3)" }}
                  onPointerDown={handlePlayheadPointerDown}
                >
                  <div
                    className="absolute left-1/2 -translate-x-1/2 -top-0.5 w-3 h-3 rounded-sm border-2 border-white shadow"
                    style={{ backgroundColor: PLAYHEAD_COLOR }}
                  />
                </div>
              )}
            </div>
          </div>
          </div>{/* end height:176 timeline tracks */}

          {/* Minimap: full timeline overview + viewport + playhead */}
          {timelineWidth > 0 && effectiveDuration > 0 && sceneBlocks.length > 0 && (
            <div className="shrink-0 border-t border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2">
              <div
                className="relative h-8 rounded overflow-hidden cursor-pointer border border-[#2a2a2a]"
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  const el = scrollContainerRef.current;
                  const mm = e.currentTarget;
                  if (!el || !mm) return;
                  const rect = mm.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const pct = Math.max(0, Math.min(1, x / rect.width));
                  el.scrollLeft = pct * (el.scrollWidth - el.clientWidth);
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                }}
              >
                {/* Mini scene blocks */}
                <div className="absolute inset-0 flex flex-row">
                  {sceneBlocks.map((scene, i) => (
                    <div
                      key={scene.id}
                      className="h-full shrink-0 border-r border-white/20 last:border-r-0"
                      style={{
                        width: `${((scene.endTime - scene.startTime) / effectiveDuration) * 100}%`,
                        backgroundColor: SCENE_COLOR_HEX[i % SCENE_COLOR_HEX.length] ?? DEFAULT_SCENE_COLOR,
                      }}
                    />
                  ))}
                </div>
                {/* Viewport indicator */}
                {scrollState.scrollWidth > scrollState.clientWidth && (
                  <div
                    className="absolute top-0 bottom-0 bg-white/30 border border-primary/50 pointer-events-none"
                    style={{
                      left: `${(scrollState.scrollLeft / scrollState.scrollWidth) * 100}%`,
                      width: `${(scrollState.clientWidth / scrollState.scrollWidth) * 100}%`,
                    }}
                  />
                )}
                {/* Playhead on minimap */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-10"
                  style={{ left: `${(currentTime / effectiveDuration) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>{/* end bottom section */}
        </> )}

      {/* Transition badge popover — fixed overlay so it is never clipped by timeline overflow */}
      {transitionBadgeOpen !== null && transitionBadgePos && (() => {
        const TRANSITION_OPTIONS: Array<{ value: string; label: string }> = [
          { value: "fade", label: "Fade" },
          { value: "slideLeft", label: "◀ Slide Left" },
          { value: "slideRight", label: "▶ Slide Right" },
          { value: "wipe", label: "Wipe" },
          { value: "pushUp", label: "▲ Push Up" },
          { value: "pushDown", label: "▼ Push Down" },
          { value: "zoom", label: "⊕ Zoom" },
          { value: "blur", label: "◎ Blur" },
          { value: "spin", label: "↻ Spin" },
          { value: "flip", label: "⇄ Flip" },
        ];
        return (
          <>
            {/* backdrop to close on outside click */}
            <div
              className="fixed inset-0 z-[998]"
              onClick={() => { setTransitionBadgeOpen(null); setTransitionBadgePos(null); }}
            />
            <div
              className="fixed z-[999] bg-[#1a1a1a] border border-[#3a3a3a] rounded-xl shadow-2xl py-1.5 min-w-[160px]"
              style={{ left: transitionBadgePos.x, top: transitionBadgePos.y - 8, transform: "translate(-50%, -100%)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-[9px] text-[#606060] px-3 py-1 font-semibold uppercase tracking-widest">Transition</p>
              {TRANSITION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-[#2a2a2a] transition-colors flex items-center gap-2 ${sceneTransitionType === opt.value ? "text-[#f97316] font-semibold" : "text-[#d0d0d0]"}`}
                  onClick={() => {
                    setSceneTransitionType(opt.value as Parameters<typeof setSceneTransitionType>[0]);
                    setTransitionBadgeOpen(null);
                    setTransitionBadgePos(null);
                  }}
                >
                  {sceneTransitionType === opt.value ? <span className="text-[#f97316] text-[10px]">●</span> : <span className="w-2.5 inline-block" />}
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        );
      })()}
      </main>
        </div>
      </div>
    </>
  );
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
