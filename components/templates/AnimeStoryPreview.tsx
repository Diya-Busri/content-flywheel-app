"use client";

import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AnimeStoryScene = {
  sceneNumber: number;
  visualDescription: string;
  subtitleText: string;
  voiceoverLine: string;
};

// ─── Phase labels ─────────────────────────────────────────────────────────────

const PHASE_LABELS: Record<string, string> = {
  "generating-script": "Generating script...",
  "generating-images": "Generating images...",
  "assembling-video": "Assembling video...",
};

function resolvePhaseLabel(phase: string | null | undefined): string | null {
  if (!phase) return null;
  return PHASE_LABELS[phase] ?? phase;
}

// ─── Preview card ─────────────────────────────────────────────────────────────

export function AnimeStoryPreview({
  scenes,
  imageUrls,
  currentScene: externalCurrentScene,
  phase,
}: {
  scenes: AnimeStoryScene[];
  imageUrls: string[];
  currentScene?: number;
  phase?: string | null;
}) {
  const [internalIdx, setInternalIdx] = useState(0);

  const total = scenes.length;
  const currentIdx =
    typeof externalCurrentScene === "number"
      ? Math.min(Math.max(externalCurrentScene, 0), Math.max(total - 1, 0))
      : internalIdx;

  const scene = scenes[currentIdx] ?? null;
  const imageUrl = imageUrls[currentIdx] ?? null;
  const phaseLabel = resolvePhaseLabel(phase);

  const goTo = (idx: number) => {
    setInternalIdx(Math.min(Math.max(idx, 0), total - 1));
  };

  return (
    <div className="flex flex-col gap-3 w-full select-none">
      {/* 9:16 preview card */}
      <div
        className="relative mx-auto w-full"
        style={{ maxWidth: 360, aspectRatio: "9/16" }}
      >
        <div className="absolute inset-0 rounded-2xl overflow-hidden shadow-2xl bg-gray-950">
          {/* Background image or placeholder */}
          {imageUrl ? (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${imageUrl})` }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              {scene?.subtitleText && (
                <p className="text-white text-center font-bold text-sm px-4 leading-snug opacity-60">
                  {scene.subtitleText}
                </p>
              )}
            </div>
          )}

          {/* Dark overlay for readability */}
          {imageUrl && (
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />
          )}

          {/* Scene progress dots at top */}
          {total > 0 && (
            <div className="absolute top-3 left-0 right-0 flex justify-center gap-1 px-4 z-10 flex-wrap">
              {scenes.map((_, i) => (
                <div
                  key={i}
                  className={`rounded-full transition-all ${
                    i === currentIdx
                      ? "w-4 h-1.5 bg-white"
                      : "w-1.5 h-1.5 bg-white/40"
                  }`}
                />
              ))}
            </div>
          )}

          {/* Phase indicator */}
          {phaseLabel && (
            <div className="absolute top-8 left-0 right-0 flex justify-center z-10">
              <span className="text-xs font-semibold text-white bg-black/60 px-3 py-1 rounded-full">
                {phaseLabel}
              </span>
            </div>
          )}

          {/* Subtitle at bottom */}
          {scene?.subtitleText && imageUrl && (
            <div className="absolute bottom-6 left-4 right-4 flex justify-center z-10">
              <span className="text-white font-bold text-sm text-center bg-black/55 px-3 py-1.5 rounded-xl leading-snug max-w-full">
                {scene.subtitleText}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation arrows */}
      <div className="flex items-center justify-center gap-3 mt-1">
        <button
          onClick={() => goTo(currentIdx - 1)}
          disabled={currentIdx === 0}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-800 hover:bg-gray-700 text-white disabled:opacity-30 transition"
        >
          ←
        </button>
        <span className="text-xs text-gray-400 font-medium min-w-[48px] text-center">
          {total > 0 ? `${currentIdx + 1} / ${total}` : "—"}
        </span>
        <button
          onClick={() => goTo(currentIdx + 1)}
          disabled={currentIdx >= total - 1}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-800 hover:bg-gray-700 text-white disabled:opacity-30 transition"
        >
          →
        </button>
      </div>

      {/* Scene list */}
      <div className="mt-1 space-y-1.5 max-h-56 overflow-y-auto pr-1">
        {scenes.map((s, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`w-full text-left rounded-lg border p-2.5 text-xs transition ${
              i === currentIdx
                ? "border-purple-500 bg-purple-950/30 dark:bg-purple-950/30"
                : "border-gray-700 hover:border-gray-500 bg-gray-900/50"
            }`}
          >
            <span className="font-semibold text-gray-500 mr-1.5">#{i + 1}</span>
            <span className="text-gray-200">{s.voiceoverLine}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
