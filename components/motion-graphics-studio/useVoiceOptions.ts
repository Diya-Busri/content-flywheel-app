"use client";

/**
 * Shared ElevenLabs voice list fetcher for Motion Graphics Studio.
 *
 * Used by both the Scene Editor's per-scene voice picker (SceneEditorPanel.tsx)
 * and the AI Script to Video panel's voice picker (ScriptToVideoPanel.tsx) —
 * factored out here so there's exactly one fetch/cache implementation instead
 * of two copies drifting apart.
 */

import { useEffect, useState } from "react";

export interface VoiceOption {
  id: string;
  name: string;
  category?: string;
}

// Module-level cache so every consumer on the page shares one
// GET /api/admin/motion-graphics/voice request instead of each refiring it.
let cachedVoices: VoiceOption[] | null = null;

export function useVoiceOptions(): { voices: VoiceOption[]; loading: boolean; error: string | null } {
  const [voices, setVoices] = useState<VoiceOption[]>(cachedVoices ?? []);
  const [loading, setLoading] = useState(!cachedVoices);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedVoices) return;
    let cancelled = false;
    fetch("/api/admin/motion-graphics/voice")
      .then((res) => res.json())
      .then((data: { voices?: VoiceOption[] }) => {
        if (cancelled) return;
        const list = data.voices ?? [];
        cachedVoices = list;
        setVoices(list);
      })
      .catch((err) => {
        console.error("Failed to load voices:", err);
        if (!cancelled) setError("Couldn't load voice list");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { voices, loading, error };
}
