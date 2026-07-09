"use client";

import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type StickmanStoryScene = {
  sceneNumber: number;
  visualDescription: string;
  narration: string;
  captionText: string;
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

export function StickmanStoryPreview({
  scenes,
  imageUrls,
  currentScene: externalCurrentScene,
  phase,
}: {
  scenes: StickmanStoryScene[];
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
      {/* 9:16 preview card — whiteboard light aesthetic */}
      <div
        className="relative mx-auto w-full"
        style={{ maxWidth: 360, aspectRatio: "9/16" }}
      >
        <div className="absolute inset-0 rounded-2xl overflow-hidden shadow-2xl bg-gray-50">
          {/* Background image or white placeholder */}
          {imageUrl ? (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${imageUrl})` }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-white">
              {scene?.captionText && (
                <p className="text-gray-700 text-center font-bold text-sm px-4 leading-snug">
                  {scene.captionText}
                </p>
              )}
            </div>
          )}

          {/* Scene progress dots at top (below caption area) */}
          {total > 0 && (
            <div className="absolute top-14 left-0 right-0 flex justify-center gap-1 px-4 z-10 flex-wrap">
              {scenes.map((_, i) => (
                <div
                  key={i}
                  className={`rounded-full transition-all ${
                    i === currentIdx
                      ? "w-4 h-1.5 bg-gray-700"
                      : "w-1.5 h-1.5 bg-gray-400/60"
                  }`}
                />
              ))}
            </div>
          )}

          {/* Caption text at TOP — dark text on white pill */}
          {scene?.captionText && imageUrl && (
            <div className="absolute top-4 left-4 right-4 flex justify-center z-10">
              <span className="text-gray-900 font-extrabold text-sm text-center bg-white/75 px-3 py-1.5 rounded-xl leading-snug max-w-full shadow-sm">
                {scene.captionText}
              </span>
            </div>
          )}

          {/* Phase indicator */}
          {phaseLabel && (
            <div className="absolute bottom-8 left-0 right-0 flex justify-center z-10">
              <span className="text-xs font-semibold text-gray-700 bg-white/80 px-3 py-1 rounded-full shadow-sm">
                {phaseLabel}
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
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 disabled:opacity-30 transition"
        >
          ←
        </button>
        <span className="text-xs text-gray-500 font-medium min-w-[48px] text-center">
          {total > 0 ? `${currentIdx + 1} / ${total}` : "—"}
        </span>
        <button
          onClick={() => goTo(currentIdx + 1)}
          disabled={currentIdx >= total - 1}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 disabled:opacity-30 transition"
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
                ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20"
                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500"
            }`}
          >
            <span className="font-semibold text-gray-400 mr-1.5">#{i + 1}</span>
            <span className="text-gray-700 dark:text-gray-300">{s.narration}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
