"use client";

/**
 * Live preview for the Template Builder — play/pause, scrub timeline, zoom
 * timeline, and frame-by-frame stepping, backed by @remotion/player (runs
 * the exact same MotionGraphicsComposition used for the final server-side
 * render, so what you see here is what you get on export).
 */

import React, { useEffect, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import {
  MotionGraphicsCompositionUntyped,
  calculateMotionGraphicsMetadata,
  type MotionGraphicsCompositionProps,
} from "@/src/remotion/motion-graphics/MotionGraphicsComposition";

function formatTimecode(frame: number, fps: number): string {
  const totalSeconds = frame / fps;
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  const f = frame % fps;
  return `${m}:${s.toString().padStart(2, "0")}:${f.toString().padStart(2, "0")}`;
}

export const PreviewPlayer: React.FC<{ inputProps: MotionGraphicsCompositionProps; fps?: number }> = ({
  inputProps,
  fps = 30,
}) => {
  const playerRef = useRef<PlayerRef>(null);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);

  const { durationInFrames, width, height } = calculateMotionGraphicsMetadata(inputProps);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onFrame = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    player.addEventListener("frameupdate", onFrame);
    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    return () => {
      player.removeEventListener("frameupdate", onFrame);
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerRef.current]);

  const stepFrame = (delta: number) => {
    playerRef.current?.pause();
    const next = Math.min(Math.max(frame + delta, 0), durationInFrames - 1);
    playerRef.current?.seekTo(next);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="bg-black rounded-lg overflow-hidden shadow-lg"
        style={{ width: `${Math.round(280 * zoom)}px`, aspectRatio: `${width}/${height}` }}
      >
        <Player
          ref={playerRef}
          component={MotionGraphicsCompositionUntyped}
          inputProps={inputProps}
          durationInFrames={durationInFrames}
          compositionWidth={width}
          compositionHeight={height}
          fps={fps}
          style={{ width: "100%", height: "100%" }}
          controls={false}
          clickToPlay={false}
        />
      </div>

      <div className="w-full max-w-md space-y-2">
        <Slider
          value={[frame]}
          min={0}
          max={Math.max(durationInFrames - 1, 0)}
          step={1}
          onValueChange={([v]) => playerRef.current?.seekTo(v)}
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatTimecode(frame, fps)}</span>
          <span>{formatTimecode(durationInFrames - 1, fps)}</span>
        </div>

        <div className="flex items-center justify-center gap-2">
          <Button size="icon" variant="outline" onClick={() => stepFrame(-1)} title="Previous frame">
            <ChevronLeft size={16} />
          </Button>
          <Button size="icon" onClick={() => playerRef.current?.toggle()} title={playing ? "Pause" : "Play"}>
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </Button>
          <Button size="icon" variant="outline" onClick={() => stepFrame(1)} title="Next frame">
            <ChevronRight size={16} />
          </Button>

          <div className="flex items-center gap-1 ml-4">
            <Button size="icon" variant="ghost" onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))} title="Zoom out">
              <ZoomOut size={14} />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setZoom((z) => Math.min(2, z + 0.15))} title="Zoom in">
              <ZoomIn size={14} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
