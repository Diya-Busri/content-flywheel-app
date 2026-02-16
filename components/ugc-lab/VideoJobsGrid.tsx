"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Film, Loader2, RefreshCw, CheckCircle, XCircle, AlertCircle, RotateCcw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { RegenerateModal, type RegenerateMode } from "./RegenerateModal";

const POLL_INTERVAL_MS = 3000;

export type VideoJob = {
  id: string;
  userId: string;
  campaignId?: string | null;
  batchId: string | null;
  parentJobId?: string | null;
  angleType?: string | null;
  scriptId?: string | null;
  templateId: string | null;
  faceProfileId: string | null;
  fullScript: string;
  hookPreview: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: string | null;
  videoUrl: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

type VideoJobsGridProps = {
  batchId: string | null;
  onRefresh?: () => void;
  onViewAll?: () => void;
  onSelectJob?: (job: VideoJob | null) => void;
  selectedJobId?: string | null;
  productContext?: string; // passed to regenerate for script/angle generation
};

export function VideoJobsGrid({ batchId, onRefresh, onViewAll, onSelectJob, selectedJobId, productContext }: VideoJobsGridProps) {
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [regenerateJob, setRegenerateJob] = useState<VideoJob | null>(null);
  const [regenerateLoading, setRegenerateLoading] = useState(false);
  const { toast } = useToast();

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const url = batchId
        ? `/api/ugc-lab/video-jobs?batchId=${encodeURIComponent(batchId)}`
        : "/api/ugc-lab/video-jobs";
      const res = await fetch(url);
      const data = await res.json();
      if (data.jobs) setJobs(data.jobs);
    } catch {
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Poll jobs that are still pending or processing
  const activeCount = jobs.filter(
    (j) => j.status === "pending" || j.status === "processing"
  ).length;

  useEffect(() => {
    if (activeCount === 0) return;
    const t = setInterval(fetchJobs, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [activeCount, fetchJobs]);

  const handleRegenerate = async (jobId: string, mode: RegenerateMode) => {
    setRegenerateLoading(true);
    try {
      const res = await fetch(`/api/ugc-lab/video-jobs/${jobId}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, productContext: productContext || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Regenerate failed");
      toast({
        title: "Regeneration started",
        description: "New job created. Previous version remains in history.",
      });
      setRegenerateJob(null);
      fetchJobs();
      onRefresh?.();
    } catch (err) {
      toast({
        title: "Regenerate failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setRegenerateLoading(false);
    }
  };

  const handleRetry = async (jobId: string) => {
    try {
      const res = await fetch(`/api/ugc-lab/video-jobs/${jobId}/retry`, {
        method: "POST",
      });
      if (res.ok) {
        toast({ title: "Retrying", description: "Job queued for retry." });
        fetchJobs();
        onRefresh?.();
      } else {
        const data = await res.json();
        toast({ title: "Retry failed", description: data.error, variant: "destructive" });
      }
    } catch (err) {
      toast({
        title: "Retry failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  if (loading && jobs.length === 0) {
    return (
      <Card className="flex-1 min-h-0 flex flex-col">
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Film className="w-4 h-4" />
            Video Jobs Grid
          </CardTitle>
          <CardDescription className="text-xs">
            Loading jobs…
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 flex-1 min-h-0 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex-1 min-h-0 flex flex-col">
      <CardHeader className="py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Film className="w-4 h-4" />
              Video Jobs Grid
            </CardTitle>
            <CardDescription className="text-xs">
              {batchId ? "Current batch" : "Status indicators and queue"}
            </CardDescription>
          </div>
          {batchId && onViewAll && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={onViewAll}>
              View all
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-1 min-h-0 overflow-y-auto">
        {jobs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
            No jobs yet. Click Generate to create variations.
          </div>
        ) : (
          <div className="grid gap-2">
            {jobs.map((job) => (
              <div
                key={job.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectJob?.(job)}
                onKeyDown={(e) => e.key === "Enter" && onSelectJob?.(job)}
                className={`rounded-lg border p-3 space-y-2 cursor-pointer transition-colors ${
                  selectedJobId === job.id
                    ? "border-violet-500 dark:border-violet-400 bg-violet-50/50 dark:bg-violet-900/20"
                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                }`}
              >
                <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2" title={job.hookPreview}>
                  {job.hookPreview}
                </p>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <StatusBadge status={job.status} />
                  {(job.status === "pending" || job.status === "processing") && (
                    <Progress
                      value={parseInt(job.progress ?? "0", 10)}
                      className="h-1.5 flex-1 max-w-[80px]"
                    />
                  )}
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRegenerateJob(job);
                      }}
                    >
                      <RotateCcw className="w-3 h-3" />
                      Regenerate
                    </Button>
                    {job.status === "failed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRetry(job.id);
                        }}
                      >
                        <RefreshCw className="w-3 h-3" />
                        Retry
                      </Button>
                    )}
                  </div>
                </div>
                {job.status === "failed" && job.error && (
                  <p className="text-xs text-red-600 dark:text-red-400 line-clamp-1">
                    {job.error}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {regenerateJob && (
        <RegenerateModal
          open={!!regenerateJob}
          onOpenChange={(open) => !open && setRegenerateJob(null)}
          jobId={regenerateJob.id}
          hookPreview={regenerateJob.hookPreview}
          productContext={productContext}
          onRegenerate={(mode) => handleRegenerate(regenerateJob.id, mode)}
          loading={regenerateLoading}
        />
      )}
    </Card>
  );
}

function StatusBadge({ status }: { status: VideoJob["status"] }) {
  const config = {
    pending: { icon: AlertCircle, label: "Pending", className: "text-slate-500" },
    processing: { icon: Loader2, label: "Processing", className: "text-amber-600 dark:text-amber-400" },
    completed: { icon: CheckCircle, label: "Completed", className: "text-green-600 dark:text-green-400" },
    failed: { icon: XCircle, label: "Failed", className: "text-red-600 dark:text-red-400" },
  };
  const c = config[status];
  const Icon = c.icon;
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${c.className}`}>
      {status === "processing" ? (
        <Icon className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Icon className="w-3.5 h-3.5" />
      )}
      {c.label}
    </span>
  );
}
