"use client";

import { useRef, useState } from "react";
import { Video, Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { extractYouTubeId } from "@/lib/academy";
import { uploadFile } from "./upload-helpers";

export function VideoUploadZone({
  value,
  videoType = "upload",
  onChange,
}: {
  value?: string;
  videoType?: "upload" | "youtube";
  onChange: (url: string, type: "upload" | "youtube") => void;
}) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"upload" | "youtube">(videoType);
  const [progress, setProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File) {
    if (!file.type.startsWith("video/")) {
      toast({ title: "Please choose a video file", variant: "destructive" });
      return;
    }
    setProgress(0);
    try {
      const { url } = await uploadFile(file, "academy-videos", "lessons", setProgress);
      onChange(url, "upload");
    } catch (e) {
      toast({
        title: "Upload failed",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setProgress(null);
    }
  }

  // Uploaded / set preview
  if (value && progress === null) {
    const ytId = tab === "youtube" ? extractYouTubeId(value) : null;
    return (
      <div className="rounded-lg border bg-card p-2">
        <div className="relative">
          {ytId ? (
            <img
              src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
              alt="YouTube thumbnail"
              className="w-full rounded-md"
            />
          ) : (
            <video src={value} controls className="w-full rounded-md bg-black" />
          )}
          <Button
            size="sm"
            variant="secondary"
            className="absolute right-2 top-2"
            onClick={() => onChange("", tab)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (progress !== null) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Uploading… {progress}%
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex border-b">
        <button
          type="button"
          onClick={() => setTab("upload")}
          className={`flex-1 px-3 py-2 text-xs font-medium ${tab === "upload" ? "border-b-2 border-primary text-foreground" : "text-muted-foreground"}`}
        >
          Upload
        </button>
        <button
          type="button"
          onClick={() => setTab("youtube")}
          className={`flex-1 px-3 py-2 text-xs font-medium ${tab === "youtube" ? "border-b-2 border-primary text-foreground" : "text-muted-foreground"}`}
        >
          YouTube URL
        </button>
      </div>

      {tab === "upload" ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          className={`flex flex-col items-center gap-2 p-6 text-center ${dragging ? "bg-primary/5" : ""}`}
        >
          <Video className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Drag &amp; drop video here</p>
          <p className="text-xs text-muted-foreground">or</p>
          <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
            <Upload className="mr-1.5 h-4 w-4" /> Click to upload
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </div>
      ) : (
        <div className="p-4">
          <Input
            placeholder="https://youtube.com/watch?v=..."
            defaultValue={tab === "youtube" ? value : ""}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && extractYouTubeId(v)) {
                onChange(v, "youtube");
              } else if (v) {
                toast({ title: "Not a valid YouTube URL", variant: "destructive" });
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
