"use client";

/**
 * useGaplessAudio — Web Audio API based gapless multi-clip player.
 *
 * Why this exists: the HTML <audio> element approach for per-clip audio has an
 * unavoidable gap between clips (React re-render + browser src-change + network
 * load latency). This hook uses the Web Audio API to schedule clips with
 * sample-accurate timing — zero gap, 60 fps time updates, instant seek.
 *
 * How it works:
 *  1. On play, fire all fetch/decode requests immediately (parallel).
 *  2. As soon as the first clip's buffer is ready → start AudioContext + schedule it.
 *  3. Schedule subsequent clips the instant their buffers arrive, chaining them to
 *     end exactly where the previous clip ends (no overlap, no gap).
 *  4. A requestAnimationFrame loop provides ~60 fps currentTime updates.
 *  5. Seek: cancel all scheduled sources, restart from new position.
 */

import { useRef, useCallback, useState, useEffect, useLayoutEffect } from "react";

export type GaplessClip = {
  id: string;
  audioUrl: string;
  /** Where this clip sits on the global timeline (seconds). */
  startTime: number;
  /** Duration of this clip's slot on the global timeline (seconds). */
  duration: number;
};

type ActiveSource = {
  node: AudioBufferSourceNode;
  clipId: string;
  /** AudioContext time when this source was scheduled to start. */
  ctxStart: number;
};

export function useGaplessAudio({
  clips,
  enabled = true,
  playbackRate = 1,
  onTimeUpdate,
  onPlaybackEnded,
  onIsPlayingChange,
}: {
  clips: GaplessClip[];
  enabled?: boolean;
  /** Playback speed multiplier. Default 1. 0.5 = half speed, 2 = double speed. */
  playbackRate?: number;
  /** Called ~60 fps with the current timeline position in seconds. */
  onTimeUpdate?: (t: number) => void;
  onPlaybackEnded?: () => void;
  onIsPlayingChange?: (playing: boolean) => void;
}) {
  // ─── refs (survive re-renders, no stale-closure issues) ──────────────────
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const activeSourcesRef = useRef<ActiveSource[]>([]);
  const bufferCache = useRef<Map<string, AudioBuffer>>(new Map());
  /** Promises keyed by URL so parallel await calls share one fetch. */
  const inFlight = useRef<Map<string, Promise<AudioBuffer | null>>>(new Map());

  /** Incremented whenever play/pause/seek cancels in-progress scheduling. */
  const genRef = useRef(0);
  const rafIdRef = useRef(0);

  /** AudioContext.currentTime captured at the moment we called play(). */
  const playStartCtxRef = useRef(0);
  /** Timeline position at the moment we called play(). */
  const playStartTimelineRef = useRef(0);
  /** Timeline position where we paused (or 0 initially). */
  const pausedAtRef = useRef(0);

  const isPlayingRef = useRef(false);

  // ─── stable callback refs (avoids stale closures in RAF / async loops) ───
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onPlaybackEndedRef = useRef(onPlaybackEnded);
  const onIsPlayingChangeRef = useRef(onIsPlayingChange);
  const playbackRateRef = useRef(playbackRate);
  useLayoutEffect(() => { onTimeUpdateRef.current = onTimeUpdate; });
  useLayoutEffect(() => { onPlaybackEndedRef.current = onPlaybackEnded; });
  useLayoutEffect(() => { onIsPlayingChangeRef.current = onIsPlayingChange; });
  useLayoutEffect(() => { playbackRateRef.current = Math.max(0.1, playbackRate); });

  // ─── React state (UI) ────────────────────────────────────────────────────
  const [isPlaying, setIsPlayingState] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);

  // ─── helpers ─────────────────────────────────────────────────────────────

  const setIsPlaying = useCallback((v: boolean) => {
    isPlayingRef.current = v;
    setIsPlayingState(v);
    onIsPlayingChangeRef.current?.(v);
  }, []);

  /** Create (or return) the shared AudioContext + master gain. */
  const getCtx = useCallback((): AudioContext => {
    if (!ctxRef.current) {
      const Ctx = (typeof AudioContext !== "undefined" ? AudioContext : (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      ctxRef.current = new Ctx();
      gainRef.current = ctxRef.current.createGain();
      gainRef.current.connect(ctxRef.current.destination);
    }
    return ctxRef.current;
  }, []);

  /** Fetch + decode a clip URL, caching the result. Parallel calls share one fetch. */
  const loadBuffer = useCallback(async (url: string): Promise<AudioBuffer | null> => {
    if (bufferCache.current.has(url)) return bufferCache.current.get(url)!;
    if (inFlight.current.has(url)) return inFlight.current.get(url)!;

    const promise = (async (): Promise<AudioBuffer | null> => {
      try {
        const res = await fetch(url, { mode: "cors", credentials: "omit" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const ab = await res.arrayBuffer();
        // ctx might not exist yet if called before first play(); create it now
        const ctx = getCtx();
        const buf = await ctx.decodeAudioData(ab);
        bufferCache.current.set(url, buf);
        return buf;
      } catch (e) {
        console.error("[GaplessAudio] Load failed:", url, e);
        inFlight.current.delete(url);
        return null;
      }
    })();

    inFlight.current.set(url, promise);
    return promise;
  }, [getCtx]);

  /** Stop + disconnect all scheduled AudioBufferSourceNodes. */
  const cancelSources = useCallback(() => {
    for (const { node } of activeSourcesRef.current) {
      try { node.stop(0); } catch { /* already stopped */ }
      node.disconnect();
    }
    activeSourcesRef.current = [];
  }, []);

  const stopRaf = useCallback(() => {
    if (rafIdRef.current) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = 0; }
  }, []);

  /** Current global timeline position (seconds). Works whether playing or paused. */
  const getCurrentTime = useCallback((): number => {
    if (!isPlayingRef.current || !ctxRef.current) return pausedAtRef.current;
    return playStartTimelineRef.current + (ctxRef.current.currentTime - playStartCtxRef.current) * playbackRateRef.current;
  }, []);

  /** Start the 60 fps RAF loop that drives time + caption updates. */
  const startRaf = useCallback(() => {
    stopRaf();
    const tick = () => {
      if (!isPlayingRef.current) return;
      const t = getCurrentTime();
      onTimeUpdateRef.current?.(t);

      // Auto-stop at end of last clip
      const totalEnd = clips.reduce((m, c) => Math.max(m, c.startTime + c.duration), 0);
      if (clips.length > 0 && t >= totalEnd - 0.05) {
        pausedAtRef.current = totalEnd;
        setIsPlaying(false);
        stopRaf();
        onTimeUpdateRef.current?.(totalEnd);
        onPlaybackEndedRef.current?.();
        return;
      }
      rafIdRef.current = requestAnimationFrame(tick);
    };
    rafIdRef.current = requestAnimationFrame(tick);
  }, [clips, getCurrentTime, setIsPlaying, stopRaf]);

  // ─── core scheduling logic ────────────────────────────────────────────────

  /**
   * Schedule clips starting from `fromTime`.
   * All clips are fetched in parallel immediately (fire-and-forget into loadBuffer).
   * They are then scheduled in timeline order as their buffers become available.
   * The generation counter `gen` lets us abort if play/pause/seek is called again.
   */
  const scheduleClips = useCallback(async (fromTime: number, gen: number) => {
    const ctx = ctxRef.current!;
    const gain = gainRef.current!;

    const relevant = clips
      .filter((c) => c.startTime + c.duration > fromTime)
      .sort((a, b) => a.startTime - b.startTime);

    if (relevant.length === 0) return;

    // Fire all fetches NOW (parallel). loadBuffer de-dupes concurrent calls.
    relevant.forEach((c) => { loadBuffer(c.audioUrl); });

    // `nextCtxTime` tracks the exact AudioContext timestamp where the next clip
    // should begin. Starts uninitialised (0) and is set once the first clip plays.
    let nextCtxTime = 0;
    let firstClip = true;

    for (let i = 0; i < relevant.length; i++) {
      if (gen !== genRef.current) return; // cancelled

      const clip = relevant[i];
      const buf = await loadBuffer(clip.audioUrl);

      if (gen !== genRef.current || !buf) return;

      // For the first clip we might start mid-way through it (seek position)
      const bufferOffset = firstClip ? Math.max(0, fromTime - clip.startTime) : 0;
      const remaining = buf.duration - bufferOffset;
      if (remaining <= 0.01) {
        firstClip = false;
        continue;
      }

      // First clip: start ASAP (add a tiny lookahead so the node is ready)
      // Subsequent clips: schedule exactly when the previous clip ends
      const scheduleAt = firstClip
        ? Math.max(ctx.currentTime + 0.01, ctx.currentTime)
        : Math.max(ctx.currentTime + 0.01, nextCtxTime);

      const rate = playbackRateRef.current;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      src.connect(gain);
      src.start(scheduleAt, bufferOffset);
      // No stop() — let it play to its natural end for gapless chaining

      activeSourcesRef.current.push({ node: src, clipId: clip.id, ctxStart: scheduleAt });

      // With playbackRate=r, r seconds of buffer play in 1/r seconds of wall-clock time
      nextCtxTime = scheduleAt + remaining / rate;
      firstClip = false;
    }
  }, [clips, loadBuffer]);

  // ─── public API ──────────────────────────────────────────────────────────

  const play = useCallback(async (fromTime?: number) => {
    if (!enabled) return;

    const ctx = getCtx();
    if (ctx.state === "suspended") await ctx.resume();

    const startFrom = fromTime ?? pausedAtRef.current;
    const gen = ++genRef.current;

    cancelSources();
    stopRaf();

    playStartTimelineRef.current = startFrom;
    playStartCtxRef.current = ctx.currentTime;
    pausedAtRef.current = startFrom;

    setIsPlaying(true);

    // Kick off parallel loading immediately; show buffering only if first clip
    // takes more than ~200 ms (avoids flash for cached clips)
    const firstClip = clips
      .filter((c) => c.startTime + c.duration > startFrom)
      .sort((a, b) => a.startTime - b.startTime)[0];

    if (!firstClip) {
      setIsPlaying(false);
      onPlaybackEndedRef.current?.();
      return;
    }

    // Show buffering indicator after 200ms if not yet ready
    const bufferingTimer = setTimeout(() => {
      if (gen === genRef.current && isPlayingRef.current) setIsBuffering(true);
    }, 200);

    // Wait for first clip so RAF starts immediately when audio starts
    const firstBuf = await loadBuffer(firstClip.audioUrl);
    clearTimeout(bufferingTimer);

    if (gen !== genRef.current) return; // cancelled while loading
    setIsBuffering(false);

    if (!firstBuf) {
      // First clip failed; try to continue from second
      setIsPlaying(false);
      return;
    }

    // Update reference time NOW (after await) so scheduling is accurate
    playStartCtxRef.current = ctx.currentTime;
    startRaf();

    // Schedule all clips (async, in background — won't block RAF)
    scheduleClips(startFrom, gen);
  }, [enabled, clips, getCtx, cancelSources, stopRaf, startRaf, loadBuffer, scheduleClips, setIsPlaying]);

  const pause = useCallback(async () => {
    pausedAtRef.current = getCurrentTime();
    ++genRef.current;
    cancelSources();
    stopRaf();
    setIsPlaying(false);
    setIsBuffering(false);
    // Suspend context to stop all audio immediately and save CPU
    try { await ctxRef.current?.suspend(); } catch { /* ignore */ }
  }, [cancelSources, getCurrentTime, setIsPlaying, stopRaf]);

  const seek = useCallback((time: number) => {
    const wasPlaying = isPlayingRef.current;
    pausedAtRef.current = time;
    ++genRef.current;
    cancelSources();
    stopRaf();
    setIsPlaying(false);
    setIsBuffering(false);
    if (wasPlaying) {
      // Resume context first (may be suspended from pause)
      void ctxRef.current?.resume().then(() => play(time));
    }
  }, [cancelSources, play, setIsPlaying, stopRaf]);

  // ─── cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    const gen = genRef;
    const ctx = ctxRef;
    return () => {
      ++gen.current;
      cancelSources();
      stopRaf();
      ctx.current?.close().catch(() => {});
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Return a decoded AudioBuffer from cache (available after first play). Useful for waveform rendering. */
  const getBuffer = useCallback((url: string): AudioBuffer | null => {
    return bufferCache.current.get(url) ?? null;
  }, []);

  return { isPlaying, isBuffering, play, pause, seek, getCurrentTime, getBuffer };
}
