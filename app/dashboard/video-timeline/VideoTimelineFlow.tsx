"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Film, Music, Play, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type TimelineClip = {
  id: string;
  type: "video" | "audio";
  file: File;
  url: string;
  name: string;
};

const VIDEO_ACCEPT = "video/*";
const AUDIO_ACCEPT = "audio/*";

function SortableClip({
  clip,
  onRemove,
}: {
  clip: TimelineClip;
  onRemove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: clip.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-card p-3 text-card-foreground shadow-sm",
        isDragging && "opacity-60 shadow-md z-10"
      )}
    >
      <button
        type="button"
        className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 -ml-1"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      {clip.type === "video" ? (
        <Film className="w-5 h-5 flex-shrink-0 text-muted-foreground" />
      ) : (
        <Music className="w-5 h-5 flex-shrink-0 text-muted-foreground" />
      )}
      <span className="flex-1 truncate text-sm font-medium" title={clip.name}>
        {clip.name}
      </span>
      <span className="text-xs text-muted-foreground flex-shrink-0">
        {clip.type}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive"
        onClick={() => onRemove(clip.id)}
        aria-label="Remove clip"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}

export default function VideoTimelineFlow() {
  const [clips, setClips] = useState<TimelineClip[]>([]);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const clipsRef = useRef<TimelineClip[]>([]);
  clipsRef.current = clips;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setClips((prev) => {
      const oldIndex = prev.findIndex((c) => c.id === active.id);
      const newIndex = prev.findIndex((c) => c.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const addFiles = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    const newClips: TimelineClip[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const type = file.type.startsWith("video/")
        ? "video"
        : file.type.startsWith("audio/")
          ? "audio"
          : null;
      if (!type) continue;
      const url = URL.createObjectURL(file);
      newClips.push({
        id: `${Date.now()}-${i}-${file.name}`,
        type,
        file,
        url,
        name: file.name,
      });
    }
    setClips((prev) => [...prev, ...newClips]);
  }, []);

  const removeClip = useCallback((id: string) => {
    setClips((prev) => {
      const clip = prev.find((c) => c.id === id);
      if (clip) URL.revokeObjectURL(clip.url);
      return prev.filter((c) => c.id !== id);
    });
    setPlayingIndex(null);
  }, []);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      clipsRef.current.forEach((c) => URL.revokeObjectURL(c.url));
    };
  }, []);

  const playSequence = useCallback(() => {
    if (clips.length === 0) return;
    setPlayingIndex(0);
  }, [clips.length]);

  const stopSequence = useCallback(() => {
    setPlayingIndex(null);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  // When playingIndex is set, play that clip; when it ends, advance to next
  useEffect(() => {
    if (playingIndex === null || playingIndex >= clips.length) {
      if (playingIndex !== null && clips.length === 0) setPlayingIndex(null);
      return;
    }
    const clip = clips[playingIndex];
    const goNext = () => {
      setPlayingIndex((i) => (i === null ? null : i + 1 >= clips.length ? null : i + 1));
    };

    if (clip.type === "video") {
      const el = videoRef.current;
      if (!el) return;
      el.src = clip.url;
      el.style.display = "block";
      if (audioRef.current) audioRef.current.style.display = "none";
      el.play().catch(() => goNext());
      el.onended = goNext;
      return () => {
        el.onended = null;
        el.pause();
      };
    } else {
      const el = audioRef.current;
      if (!el) return;
      el.src = clip.url;
      el.style.display = "block";
      if (videoRef.current) videoRef.current.style.display = "none";
      el.play().catch(() => goNext());
      el.onended = goNext;
      return () => {
        el.onended = null;
        el.pause();
      };
    }
  }, [clips, playingIndex]);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Video Timeline
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload video clips and voiceover audio, arrange them on the timeline, and preview. No rendering yet.
        </p>
      </div>

      {/* Preview player at top */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preview</CardTitle>
          <p className="text-sm text-muted-foreground">
            Play the sequence in timeline order.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-black/5 dark:bg-black/30 aspect-video flex items-center justify-center min-h-[200px] overflow-hidden">
            <video
              ref={videoRef}
              className="max-w-full max-h-full object-contain hidden"
              muted
              playsInline
              controls
            />
            <audio ref={audioRef} className="hidden" controls />
            {playingIndex === null && clips.length === 0 && (
              <p className="text-sm text-muted-foreground">Add clips below, then play.</p>
            )}
            {playingIndex === null && clips.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Click &quot;Play sequence&quot; to preview.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              size="sm"
              onClick={playSequence}
              disabled={clips.length === 0 || playingIndex !== null}
            >
              <Play className="w-4 h-4 mr-1" />
              Play sequence
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={stopSequence}
              disabled={playingIndex === null}
            >
              <Square className="w-4 h-4 mr-1" />
              Stop
            </Button>
            {playingIndex !== null && (
              <span className="text-sm text-muted-foreground">
                Playing {playingIndex + 1} of {clips.length}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add clips
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Add video clips and generated voiceover audio. Order in the timeline is the sequence order.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <label className="cursor-pointer">
            <input
              type="file"
              accept={VIDEO_ACCEPT}
              multiple
              className="sr-only"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <Button type="button" variant="outline" size="sm" asChild>
              <span>Add video clips</span>
            </Button>
          </label>
          <label className="cursor-pointer">
            <input
              type="file"
              accept={AUDIO_ACCEPT}
              multiple
              className="sr-only"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <Button type="button" variant="outline" size="sm" asChild>
              <span>Add voiceover</span>
            </Button>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timeline</CardTitle>
          <p className="text-sm text-muted-foreground">
            Clips appear as blocks. Drag to reorder.
          </p>
        </CardHeader>
        <CardContent>
          {clips.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center rounded-lg border border-dashed">
              No clips yet. Add video clips or voiceover above.
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={clips.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="space-y-2">
                  {clips.map((clip) => (
                    <li key={clip.id}>
                      <SortableClip clip={clip} onRemove={removeClip} />
                    </li>
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
