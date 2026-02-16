"use client";

import { useRef, useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const BACKGROUNDS = [
  { id: "gradient", label: "Gradient", className: "bg-gradient-to-br from-violet-900/40 via-slate-900 to-rose-900/40" },
  { id: "office", label: "Office", className: "bg-gradient-to-br from-slate-200 to-slate-400 dark:from-slate-700 dark:to-slate-900" },
  { id: "bedroom", label: "Bedroom", className: "bg-gradient-to-br from-amber-100 to-rose-200 dark:from-amber-950/50 dark:to-rose-950/50" },
  { id: "studio", label: "Studio", className: "bg-slate-950" },
] as const;

type BackgroundId = (typeof BACKGROUNDS)[number]["id"];

// Free ambient music from Pixabay (royalty-free)
const MUSIC_TRACKS = [
  { id: "none", label: "Off", url: null },
  { id: "ambient", label: "Ambient", url: "https://cdn.pixabay.com/audio/2022/05/27/audio_3c5d97d952.mp3" },
  { id: "upbeat", label: "Upbeat", url: "https://cdn.pixabay.com/audio/2022/08/04/audio_06e72cb8dc.mp3" },
] as const;

// B-roll mode uses gradient overlay (no external video; avoids CORS/loading issues)

export type AvatarPreviewPlayerProps = {
  videoUrl: string;
  scriptText: string;
  onClose?: () => void;
};

export function AvatarPreviewPlayer({ videoUrl, scriptText, onClose }: AvatarPreviewPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const musicRef = useRef<HTMLAudioElement>(null);
  const [background, setBackground] = useState<BackgroundId>("gradient");
  const [viewMode, setViewMode] = useState<"avatar-only" | "avatar-broll">("avatar-only");
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [musicTrack, setMusicTrack] = useState<(typeof MUSIC_TRACKS)[number]["id"]>("none");
  const [currentCaptionIndex, setCurrentCaptionIndex] = useState(0);

  const words = scriptText.trim().split(/\s+/).filter(Boolean);

  useEffect(() => {
    if (!captionsEnabled || words.length === 0 || !videoRef.current) return;
    const video = videoRef.current;
    const onTimeUpdate = () => {
      const t = video.currentTime;
      const duration = video.duration || 5;
      const progress = Math.min(t / duration, 1);
      const idx = Math.min(Math.floor(progress * words.length), words.length - 1);
      setCurrentCaptionIndex(idx);
    };
    const onSeeked = onTimeUpdate;
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("seeked", onSeeked);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("seeked", onSeeked);
    };
  }, [captionsEnabled, words.length]);

  useEffect(() => {
    if (musicTrack === "none" || !musicRef.current) return;
    const track = MUSIC_TRACKS.find((t) => t.id === musicTrack);
    if (!track?.url) return;
    musicRef.current.src = track.url;
    musicRef.current.volume = 0.2;
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => musicRef.current?.play().catch(() => {});
    const onPause = () => musicRef.current?.pause();
    const onEnded = () => musicRef.current?.pause();
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
    };
  }, [musicTrack]);

  const bgClass = BACKGROUNDS.find((b) => b.id === background)?.className ?? BACKGROUNDS[0].className;

  return (
    <div className="space-y-4">
      {/* View mode toggle */}
      <div className="flex items-center justify-between gap-4">
        <Label className="text-sm">View</Label>
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("avatar-only")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === "avatar-only" ? "bg-orange-500 text-white" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            Avatar only
          </button>
          <button
            type="button"
            onClick={() => setViewMode("avatar-broll")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === "avatar-broll" ? "bg-orange-500 text-white" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            Avatar + B-roll
          </button>
        </div>
      </div>

      {/* Background selection */}
      <div>
        <Label className="text-sm mb-2 block">Background</Label>
        <div className="grid grid-cols-4 gap-2">
          {BACKGROUNDS.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBackground(b.id)}
              className={`h-10 rounded-lg border-2 transition-all ${b.className} ${
                background === b.id ? "border-orange-500 ring-2 ring-orange-200 dark:ring-orange-800" : "border-slate-200 dark:border-slate-700"
              }`}
              title={b.label}
            />
          ))}
        </div>
      </div>

      {/* Captions & Music toggles */}
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <Switch id="captions" checked={captionsEnabled} onCheckedChange={setCaptionsEnabled} />
          <Label htmlFor="captions" className="text-sm cursor-pointer">
            Captions
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm">Music</Label>
          <select
            value={musicTrack}
            onChange={(e) => setMusicTrack(e.target.value as (typeof MUSIC_TRACKS)[number]["id"])}
            className="h-8 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs"
          >
            {MUSIC_TRACKS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Video player with presentation layer */}
      <div className={`relative rounded-xl overflow-hidden aspect-[9/16] max-h-[420px] ${bgClass}`}>
        {/* B-roll overlay (when avatar-broll mode): decorative gradient + pattern */}
        {viewMode === "avatar-broll" && (
          <div
            className="absolute inset-0 w-full h-full opacity-80"
            style={{
              background: "linear-gradient(135deg, rgba(99,102,241,0.3) 0%, rgba(168,85,247,0.2) 50%, rgba(236,72,153,0.2) 100%)",
              backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
            }}
          />
        )}

        {/* Avatar video container with zoom animation */}
        <div
          className={`relative w-full h-full flex items-center justify-center overflow-hidden ${
            viewMode === "avatar-broll" ? "p-4" : ""
          }`}
        >
          <div
            className={`relative overflow-hidden rounded-xl bg-black/30 ${
              viewMode === "avatar-broll" ? "w-[70%] aspect-[9/16] max-h-full shadow-xl" : "w-full h-full"
            } animate-zoom-subtle`}
          >
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* TikTok-style captions overlay (large, dynamic, animated) */}
        {captionsEnabled && words.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 p-4 pb-10 pointer-events-none">
            <div className="flex flex-wrap justify-center gap-2 items-center">
              {words.map((word, i) => (
                <span
                  key={`${word}-${i}`}
                  className={`inline-block px-2.5 py-1 text-xl sm:text-2xl font-black text-white transition-all duration-150 ease-out ${
                    i <= currentCaptionIndex
                      ? "opacity-100 scale-110"
                      : "opacity-35 scale-95"
                  }`}
                  style={{
                    textShadow: "0 2px 8px rgba(0,0,0,1), 0 0 4px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5)",
                    WebkitTextStroke: "1px rgba(0,0,0,0.5)",
                  }}
                >
                  {word}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <audio ref={musicRef} className="hidden" />

      <p className="text-xs text-slate-500">
        First 2 lines of your script. Full render will use the complete script.
      </p>
    </div>
  );
}
