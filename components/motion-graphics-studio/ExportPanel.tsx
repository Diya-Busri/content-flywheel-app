"use client";

/**
 * Admin → Motion Graphics Studio → Template Builder → Export
 *
 * Triggers a render job (app/api/admin/motion-graphics/render), polls its
 * status, and surfaces a download link when complete. The export's aspect
 * ratio follows the template's own aspectRatio (set in the builder header) —
 * since element positions are authored as percentages for that ratio,
 * exporting is always "what you designed"; to export a different ratio
 * (9:16 / 16:9 / 1:1), change the template's aspect ratio and re-render.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Loader2, PlayCircle } from "lucide-react";
import type { ExportFormat, MotionGraphicsRenderJob } from "@/lib/motion-graphics/types";

const FORMAT_OPTIONS: { id: ExportFormat; label: string }[] = [
  { id: "mp4", label: "MP4 (video)" },
  { id: "gif", label: "GIF (looping)" },
  { id: "webm", label: "WebM (video)" },
];

export const ExportPanel: React.FC<{ templateId: string; sceneCount: number }> = ({ templateId, sceneCount }) => {
  const [format, setFormat] = useState<ExportFormat>("mp4");
  const [job, setJob] = useState<MotionGraphicsRenderJob | null>(null);
  const [history, setHistory] = useState<MotionGraphicsRenderJob[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadHistory = useCallback(() => {
    fetch(`/api/admin/motion-graphics/render/history/${templateId}`)
      .then((r) => r.json())
      .then((d) => setHistory(d.jobs || []))
      .catch(() => {});
  }, [templateId]);

  useEffect(() => {
    loadHistory();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadHistory]);

  const pollJob = (jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/admin/motion-graphics/render/status/${jobId}`);
      const data = await res.json();
      if (data.job) {
        setJob(data.job);
        if (data.job.stage === "complete" || data.job.stage === "error") {
          if (pollRef.current) clearInterval(pollRef.current);
          loadHistory();
        }
      }
    }, 2000);
  };

  const handleRender = async () => {
    setJob(null);
    const res = await fetch("/api/admin/motion-graphics/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId, format }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Failed to start render");
      return;
    }
    setJob({
      id: data.jobId,
      templateId,
      userId: "",
      format,
      aspectRatio: "9:16",
      stage: "queued",
      progress: 0,
      message: "Queued…",
      createdAt: new Date().toISOString(),
    });
    pollJob(data.jobId);
  };

  const isRendering = job && job.stage !== "complete" && job.stage !== "error";

  return (
    <div className="space-y-3 border rounded-lg p-4">
      <p className="text-sm font-semibold">Export</p>

      <div className="flex items-center gap-2">
        <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FORMAT_OPTIONS.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={handleRender} disabled={!!isRendering || sceneCount === 0} className="flex-1">
          {isRendering ? <Loader2 size={15} className="animate-spin mr-2" /> : <PlayCircle size={15} className="mr-2" />}
          {isRendering ? "Rendering…" : "Render & Export"}
        </Button>
      </div>

      {sceneCount === 0 && <p className="text-xs text-muted-foreground">Add at least one scene before rendering.</p>}

      {job && (
        <div className="space-y-1.5">
          <Progress value={job.progress} />
          <p className="text-xs text-muted-foreground">{job.message}</p>
          {job.stage === "complete" && job.outputUrl && (
            <a href={job.outputUrl} download className="inline-block">
              <Button size="sm" variant="outline" className="mt-1">
                <Download size={14} className="mr-1.5" />
                Download {job.format.toUpperCase()}
              </Button>
            </a>
          )}
          {job.stage === "error" && <p className="text-xs text-destructive">{job.error}</p>}
        </div>
      )}

      {history.length > 0 && (
        <div className="pt-2 border-t space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Previous exports</p>
          {history.slice(0, 5).map((h) => (
            <div key={h.id} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {h.format.toUpperCase()} — {new Date(h.createdAt).toLocaleString()}
              </span>
              {h.stage === "complete" && h.outputUrl ? (
                <a href={h.outputUrl} download className="text-orange-500 hover:underline">
                  Download
                </a>
              ) : (
                <span className="text-muted-foreground">{h.stage}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
