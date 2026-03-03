"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Menu, PanelLeftClose } from "lucide-react";
import { useSidebar } from "@/components/sidebar-context";

const PIXELS_PER_SECOND = 80;
const TRACK_HEIGHT = 44;
const RULER_HEIGHT = 28;
const PLAYHEAD_COLOR = "#ef4444";

type CaptionBlock = { id: string; text: string; startTime: number; endTime: number };

type SceneBlock = { id: string; text: string; startTime: number; endTime: number; colorClass: string };

type ScriptContent = {
  timelineVoiceoverUrl?: string;
  timelineVoiceoverDuration?: number;
  captions?: Array<{ id?: string; text?: string; startTime?: number; endTime?: number }>;
  scenes?: Array<{ scene?: string; prompt?: string; timing?: string; [key: string]: unknown }>;
  scenePrompts?: Array<{ scene?: string; prompt?: string; timing?: string; [key: string]: unknown }>;
  [key: string]: unknown;
};

const SCENE_COLOR_CLASSES = [
  "bg-blue-600/80",
  "bg-purple-600/80",
  "bg-green-600/80",
  "bg-orange-600/80",
  "bg-pink-600/80",
];

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
  const initialScriptId = searchParams.get("scriptId") ?? searchParams.get("libraryScriptId") ?? undefined;

  const audioRef = useRef<HTMLAudioElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [scriptId, setScriptId] = useState<string | undefined>(initialScriptId);
  const [scriptName, setScriptName] = useState("");
  const [scripts, setScripts] = useState<LibraryScript[]>([]);
  const [voiceoverUrl, setVoiceoverUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [captions, setCaptions] = useState<CaptionBlock[]>([]);
  const [sceneFullTexts, setSceneFullTexts] = useState<string[]>([]);
  const [sceneMedia, setSceneMedia] = useState<({ url: string; type: "image" | "video" } | null)[]>([]);
  const [selectedSceneIndex, setSelectedSceneIndex] = useState<number | null>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const sceneMediaInputRef = useRef<HTMLInputElement>(null);
  const scenes = useMemo(() => buildSceneBlocks(sceneFullTexts, duration), [sceneFullTexts, duration]);
  const sidebar = useSidebar();

  // Clear selection if it becomes invalid (e.g. after script change)
  useEffect(() => {
    if (selectedSceneIndex !== null && (selectedSceneIndex < 0 || selectedSceneIndex >= sceneFullTexts.length)) {
      setSelectedSceneIndex(null);
    }
  }, [selectedSceneIndex, sceneFullTexts.length]);

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

  // List scripts for dropdown
  useEffect(() => {
    let cancelled = false;
    fetch("/api/library?type=scripts")
      .then((r) => r.json())
      .then((data: LibraryResponse) => {
        if (cancelled) return;
        const list = (Array.isArray(data) ? data : []).filter((i) => i.type === "script") as LibraryScript[];
        setScripts(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // When scriptId is set (incl. initial), load script and set voiceover, captions, and scenes
  useEffect(() => {
    if (!scriptId) {
      setScriptName("");
      setVoiceoverUrl(null);
      setDuration(0);
      setCaptions([]);
      setSceneFullTexts([]);
      setSceneMedia([]);
      setSelectedSceneIndex(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/library/scripts/${scriptId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Script not found");
        return r.json();
      })
      .then((row: { title?: string; content?: unknown }) => {
        if (cancelled) return;
        setScriptName(typeof row.title === "string" ? row.title : "");
        const content = parseContent(row.content);
        const url =
          typeof content.timelineVoiceoverUrl === "string" && content.timelineVoiceoverUrl.trim()
            ? content.timelineVoiceoverUrl.trim()
            : null;
        setVoiceoverUrl(url);
        const dur = typeof content.timelineVoiceoverDuration === "number" ? content.timelineVoiceoverDuration : 0;
        setDuration(dur);
        setCaptions(getCaptions(content));
        const fullTexts = getSceneFullTexts(content);
        setSceneFullTexts(fullTexts);
        setSceneMedia(fullTexts.map(() => null));
        setSelectedSceneIndex(null);
      })
      .catch(() => {
        if (!cancelled) {
          setScriptName("");
          setVoiceoverUrl(null);
          setDuration(0);
          setCaptions([]);
          setSceneFullTexts([]);
          setSceneMedia([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [scriptId]);

  // Sync initial scriptId from URL
  useEffect(() => {
    const id = searchParams.get("scriptId") ?? searchParams.get("libraryScriptId") ?? undefined;
    if (id) setScriptId(id);
  }, [searchParams]);

  // Audio events: time update, duration, play/pause
  const onTimeUpdate = useCallback(() => {
    const el = audioRef.current;
    if (el && !isDraggingPlayhead) setCurrentTime(el.currentTime);
  }, [isDraggingPlayhead]);

  const onDurationChange = useCallback(() => {
    const el = audioRef.current;
    if (el && Number.isFinite(el.duration)) setDuration(el.duration);
  }, []);

  const onPlay = useCallback(() => setIsPlaying(true), []);
  const onPause = useCallback(() => setIsPlaying(false), []);

  const play = useCallback(() => {
    audioRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const seekTo = useCallback((t: number) => {
    const el = audioRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(t, el.duration || duration));
    el.currentTime = clamped;
    setCurrentTime(clamped);
  }, [duration]);

  // Timeline width and time <-> pixel
  const totalWidth = Math.max(0, Math.ceil(duration) * PIXELS_PER_SECOND);
  const timeToX = (t: number) => (t / (duration || 1)) * totalWidth;
  const xToTime = (x: number) => (x / totalWidth) * (duration || 0);

  // Playhead drag
  const handlePlayheadPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDraggingPlayhead(true);
  }, []);

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
  }, [isDraggingPlayhead, seekTo, totalWidth, duration]);

  // Sync currentTime from audio when not dragging
  useEffect(() => {
    if (isDraggingPlayhead) return;
    const el = audioRef.current;
    if (!el) return;
    const iv = setInterval(() => setCurrentTime(el.currentTime), 100);
    return () => clearInterval(iv);
  }, [isDraggingPlayhead]);

  // Timeline click to seek
  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest("[data-playhead]")) return;
      const tl = timelineRef.current;
      if (!tl) return;
      const rect = tl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      seekTo(xToTime(x));
    },
    [seekTo]
  );

  const playheadX = timeToX(currentTime);

  // Scene media: file input and drag-drop
  const handleSceneMediaFile = useCallback(
    (file: File, sceneIndex: number) => {
      const type = file.type.startsWith("video/") ? "video" : "image";
      const url = URL.createObjectURL(file);
      setSceneMedia((prev) => {
        const next = [...prev];
        while (next.length <= sceneIndex) next.push(null);
        const old = next[sceneIndex];
        if (old) URL.revokeObjectURL(old.url);
        next[sceneIndex] = { url, type };
        return next;
      });
    },
    []
  );

  const selectedSceneDuration =
    selectedSceneIndex !== null && scenes[selectedSceneIndex]
      ? scenes[selectedSceneIndex].endTime - scenes[selectedSceneIndex].startTime
      : null;

  // Caption visible at currentTime for preview overlay (block body avoids < parsed as JSX)
  const currentCaption = captions.find((c) => {
    const t = currentTime;
    return t >= c.startTime && t < c.endTime;
  });

  return (
    <div className="min-w-0 max-w-full overflow-hidden" style={{ height: "100vh" }}>
    <div
      className={`fixed top-0 right-0 bottom-0 z-50 flex min-w-0 flex-col overflow-x-hidden overflow-y-hidden bg-background text-foreground transition-[left] duration-200 ease-out ${
        sidebar && !sidebar.isCollapsed ? "left-[60px] md:left-[220px]" : "left-0"
      }`}
    >
      <header className="shrink-0 border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-4">
          {sidebar && (
            <button
              type="button"
              onClick={sidebar.toggleCollapsed}
              className="flex-shrink-0 p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label={sidebar.isCollapsed ? "Show sidebar" : "Hide sidebar"}
            >
              {sidebar.isCollapsed ? (
                <Menu size={20} />
              ) : (
                <PanelLeftClose size={20} />
              )}
            </button>
          )}
          <label className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Script</span>
            <select
              className="rounded border border-input bg-card text-foreground px-3 py-1.5 text-sm"
              value={scriptId ?? ""}
              onChange={(e) => setScriptId(e.target.value || undefined)}
            >
              <option value="">Select a script</option>
              {scripts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
          {scriptName && <span className="text-sm text-muted-foreground">{scriptName}</span>}
        </div>
      </header>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden p-4">
        {/* 9:16 preview */}
        <div className="flex justify-center">
          <div
            className="relative overflow-hidden rounded-lg bg-card border border-border"
            style={{ aspectRatio: "9/16", width: 280 }}
          >
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
              {voiceoverUrl ? "Voiceover plays here" : "Select a script with voiceover"}
            </div>
            {currentCaption?.text && (
              <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-background/90 to-transparent flex items-end justify-center min-h-[20%]">
                <p className="text-foreground text-center text-sm leading-relaxed max-w-full">
                  {currentCaption.text}
                </p>
              </div>
            )}
            {voiceoverUrl && (
              <audio
                ref={audioRef}
                src={voiceoverUrl}
                onTimeUpdate={onTimeUpdate}
                onDurationChange={onDurationChange}
                onPlay={onPlay}
                onPause={onPause}
                preload="metadata"
                crossOrigin="anonymous"
                className="hidden"
              />
            )}
          </div>
        </div>

        {/* Playback controls */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
            onClick={isPlaying ? pause : play}
            disabled={!voiceoverUrl}
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          <span className="text-sm text-muted-foreground tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        {/* Timeline + scene edit panel */}
        <div className="flex min-h-0 min-w-0 flex-1 gap-0 overflow-hidden">
        <div className="min-h-0 min-w-0 shrink-0 flex-1 overflow-hidden rounded-lg border border-border bg-card">
          <div className="timeline-horizontal-scroll flex min-h-[140px] min-w-0 overflow-x-auto overflow-y-hidden">
            <div className="shrink-0 w-24 border-r border-border bg-muted flex flex-col text-xs text-muted-foreground">
              <div className="shrink-0 border-b border-border" style={{ height: RULER_HEIGHT }} />
              <div className="flex-1 flex flex-col">
                <div className="shrink-0 px-2 flex items-center border-b border-border" style={{ height: TRACK_HEIGHT }}>Scenes</div>
                <div className="shrink-0 px-2 flex items-center border-b border-border" style={{ height: TRACK_HEIGHT }}>Voiceover</div>
                <div className="shrink-0 px-2 flex items-center" style={{ height: TRACK_HEIGHT }}>Captions</div>
              </div>
            </div>
            <div
              ref={timelineRef}
              className="relative shrink-0 overflow-y-hidden"
              style={{ width: totalWidth || "100%", minWidth: 320 }}
              onClick={handleTimelineClick}
            >
              {/* Ruler */}
              <div
                className="sticky top-0 z-10 border-b border-border bg-muted text-xs text-muted-foreground"
                style={{ height: RULER_HEIGHT, width: totalWidth }}
              >
                {Array.from({ length: Math.ceil(duration) + 1 }, (_, i) => (
                  <div
                    key={i}
                    className="absolute border-l border-border pl-1"
                    style={{ left: i * PIXELS_PER_SECOND }}
                  >
                    {i}s
                  </div>
                ))}
              </div>

              {/* Tracks content */}
              <div style={{ width: totalWidth }}>
                <div className="relative border-b border-border" style={{ height: TRACK_HEIGHT }}>
                  {scenes.map((scene, i) => (
                    <div
                      key={scene.id}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSceneIndex(i);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedSceneIndex(i);
                        }
                      }}
                      className={`absolute top-1 h-[calc(100%-8px)] rounded px-1 overflow-hidden text-xs text-foreground cursor-pointer select-none ${scene.colorClass} ${
                        selectedSceneIndex === i ? "ring-2 ring-white ring-offset-1 ring-offset-card" : ""
                      }`}
                      style={{
                        left: timeToX(scene.startTime),
                        width: Math.max(4, timeToX(scene.endTime) - timeToX(scene.startTime)),
                      }}
                      title={scene.text}
                    >
                      <span className="truncate block">{scene.text}</span>
                    </div>
                  ))}
                </div>
                <div className="relative border-b border-border" style={{ height: TRACK_HEIGHT }}>
                  {duration > 0 && (
                    <div
                      className="absolute top-1 h-[calc(100%-8px)] rounded bg-blue-600/80"
                      style={{ left: 0, width: totalWidth }}
                    />
                  )}
                </div>
                <div className="relative" style={{ height: TRACK_HEIGHT }}>
                  {captions.map((cap) => (
                    <div
                      key={cap.id}
                      className="absolute top-1 h-[calc(100%-8px)] rounded bg-amber-600/70 px-1 overflow-hidden text-xs text-foreground"
                      style={{
                        left: timeToX(cap.startTime),
                        width: Math.max(4, timeToX(cap.endTime) - timeToX(cap.startTime)),
                      }}
                      title={cap.text}
                    >
                      <span className="truncate block">{cap.text || "—"}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Playhead */}
              {totalWidth > 0 && (
                <div
                  data-playhead
                  role="slider"
                  aria-label="Playhead"
                  aria-valuemin={0}
                  aria-valuemax={duration}
                  aria-valuenow={currentTime}
                  className="absolute top-0 bottom-0 w-0.5 cursor-ew-resize z-20"
                  style={{ left: playheadX, backgroundColor: PLAYHEAD_COLOR }}
                  onPointerDown={handlePlayheadPointerDown}
                >
                  <div
                    className="absolute left-1/2 -translate-x-1/2 -top-1 w-3 h-3 rounded-sm border border-border"
                    style={{ backgroundColor: PLAYHEAD_COLOR }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Scene edit panel */}
        <div className="min-w-[320px] w-[320px] shrink-0 flex flex-col border-l border-border bg-card overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col p-5">
            {selectedSceneIndex === null ? (
              <p className="text-sm text-muted-foreground">Click a scene to edit it.</p>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-foreground mb-5 break-words">
                  {scenes[selectedSceneIndex]?.text ?? "—"}
                </h2>

                {/* Background media */}
                <div className="mb-5">
                  <span className="text-xs font-medium text-muted-foreground block mb-2">Background media</span>
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
                  {sceneMedia[selectedSceneIndex] ? (
                    <div className="relative rounded-lg border border-border overflow-hidden bg-muted/30 aspect-video">
                      {sceneMedia[selectedSceneIndex]!.type === "image" ? (
                        <img
                          src={sceneMedia[selectedSceneIndex]!.url}
                          alt="Scene background"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <video
                          src={sceneMedia[selectedSceneIndex]!.url}
                          className="w-full h-full object-contain"
                          muted
                          playsInline
                          preload="metadata"
                        />
                      )}
                      <button
                        type="button"
                        className="absolute bottom-2 right-2 rounded bg-background/90 px-2 py-1 text-xs text-foreground border border-border hover:bg-background"
                        onClick={() => {
                          const entry = sceneMedia[selectedSceneIndex!];
                          if (entry) URL.revokeObjectURL(entry.url);
                          setSceneMedia((prev) => {
                            const next = [...prev];
                            if (selectedSceneIndex !== null && selectedSceneIndex < next.length)
                              next[selectedSceneIndex] = null;
                            return next;
                          });
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div
                      className="rounded-lg border-2 border-dashed border-border bg-muted/20 aspect-video flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted/30 transition-colors min-h-[140px]"
                      onClick={() => sceneMediaInputRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.currentTarget.classList.add("border-primary/50", "bg-muted/40");
                      }}
                      onDragLeave={(e) => {
                        e.currentTarget.classList.remove("border-primary/50", "bg-muted/40");
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.currentTarget.classList.remove("border-primary/50", "bg-muted/40");
                        const file = e.dataTransfer.files?.[0];
                        if (file && selectedSceneIndex !== null && (file.type.startsWith("image/") || file.type.startsWith("video/"))) {
                          handleSceneMediaFile(file, selectedSceneIndex);
                        }
                      }}
                    >
                      <span className="text-sm text-muted-foreground">Drop image or video here</span>
                      <button
                        type="button"
                        className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
                        onClick={(e) => {
                          e.stopPropagation();
                          sceneMediaInputRef.current?.click();
                        }}
                      >
                        Browse
                      </button>
                    </div>
                  )}
                </div>

                {/* Scene text */}
                <div className="mb-5">
                  <label className="text-xs font-medium text-muted-foreground block mb-2">Scene text</label>
                  <textarea
                    className="w-full min-h-[140px] rounded-lg border border-input bg-background px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 leading-relaxed resize-y"
                    value={sceneFullTexts[selectedSceneIndex] ?? ""}
                    onChange={(e) => {
                      const i = selectedSceneIndex;
                      if (i === null) return;
                      setSceneFullTexts((prev) => {
                        const next = [...prev];
                        if (i >= 0 && i < next.length) next[i] = e.target.value;
                        return next;
                      });
                    }}
                    placeholder="Enter scene text..."
                  />
                </div>

                {/* Duration */}
                {selectedSceneDuration !== null && (
                  <div className="mt-auto pt-3 border-t border-border">
                    <span className="text-xs font-medium text-muted-foreground block mb-1">Duration</span>
                    <p className="text-sm text-foreground tabular-nums">
                      {selectedSceneDuration.toFixed(1)}s
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        </div>
      </main>
    </div>
    </div>
  );
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
