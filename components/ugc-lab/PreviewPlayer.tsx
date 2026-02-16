"use client";

import { Loader2, Play, Film } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export type VideoJobPreview = {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: string | null;
  videoUrl: string | null;
  hookPreview: string;
  fullScript?: string;
  error: string | null;
};

type PreviewPlayerProps = {
  job: VideoJobPreview | null;
};

export function PreviewPlayer({ job }: PreviewPlayerProps) {
  if (!job) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 aspect-[9/16] max-h-[240px] flex flex-col items-center justify-center gap-2 p-4">
        <Film className="w-8 h-8 text-slate-400" />
        <span className="text-sm text-slate-500 dark:text-slate-400 text-center">
          Select a job to preview
        </span>
      </div>
    );
  }

  if (job.status === "completed" && job.videoUrl) {
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden aspect-[9/16] max-h-[280px] bg-black">
        <video
          src={job.videoUrl}
          controls
          playsInline
          className="w-full h-full object-contain"
        />
        <p className="text-xs text-slate-600 dark:text-slate-400 p-2 line-clamp-2 bg-slate-50 dark:bg-slate-900/50">
          {job.hookPreview}
        </p>
      </div>
    );
  }

  if (job.status === "completed" && !job.videoUrl) {
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden min-h-[200px] max-h-[320px] flex flex-col">
        <div className="bg-amber-50 dark:bg-amber-900/20 px-3 py-2 border-b border-amber-200 dark:border-amber-800">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
            Script ready · Video not available (check FACESWAP credentials)
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mb-1">Hook</p>
          <p className="text-sm text-slate-800 dark:text-slate-200 mb-3">{job.hookPreview}</p>
          <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mb-1">Full script</p>
          <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
            {job.fullScript || job.hookPreview}
          </p>
        </div>
      </div>
    );
  }

  if (job.status === "processing" || job.status === "pending") {
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 aspect-[9/16] max-h-[240px] flex flex-col items-center justify-center gap-4 p-4">
        <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
        <div className="w-full max-w-[160px] space-y-2">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400 text-center">
            {job.status === "processing" ? "Rendering…" : "Queued"}
          </p>
          <Progress
            value={parseInt(job.progress ?? "0", 10)}
            className="h-2"
          />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center line-clamp-2">
          {job.hookPreview}
        </p>
      </div>
    );
  }

  if (job.status === "failed") {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-900/20 aspect-[9/16] max-h-[240px] flex flex-col items-center justify-center gap-2 p-4">
        <span className="text-sm font-medium text-red-600 dark:text-red-400">
          Render failed
        </span>
        <p className="text-xs text-slate-600 dark:text-slate-400 text-center line-clamp-3">
          {job.error ?? "Unknown error"}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center line-clamp-2">
          {job.hookPreview}
        </p>
      </div>
    );
  }

  return null;
}
