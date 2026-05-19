"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2, XCircle, ChevronDown, ChevronUp, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

type ProductStatus = {
  id: string;
  bundleId: string | null;
  format: string | null;
  title: string;
  status: string;
};

type BundleJob = {
  id: string;
  niche: string;
  status: string;
  totalCount: number;
  completedCount: number;
  failedCount: number;
  generatingCount: number;
  createdAt: string;
  completedAt: string | null;
  products: ProductStatus[];
};

const FORMAT_LABELS: Record<string, string> = {
  ebook: "Ebook",
  workbook: "Workbook",
  spreadsheet: "Spreadsheet Tutorial",
  guide: "Guide",
  notion: "Notion Template",
  checklist: "Checklist Pack",
  journal: "Journal",
  planner: "Planner",
};

const POLL_INTERVAL_MS = 8000;
const DISMISSED_KEY = "cf_dismissed_bundles";

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function setDismissed(id: string) {
  try {
    const s = getDismissed();
    s.add(id);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(s)));
  } catch {}
}

export function BundleProgressBanner() {
  const [jobs, setJobs] = useState<BundleJob[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [dismissed, setDismissedState] = useState<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();
  const prevStatusRef = useRef<Record<string, string>>({});

  const dismiss = (id: string) => {
    setDismissedState((prev) => { const next = new Set(prev); next.add(id); return next; });
    setDismissed(id);
  };

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/products/bundles/active");
      if (!res.ok) return;
      const data = await res.json();
      const fresh: BundleJob[] = data.jobs ?? [];

      // Fire toast when a job transitions to completed/partial
      fresh.forEach((job) => {
        const prev = prevStatusRef.current[job.id];
        if (prev === "generating" && (job.status === "completed" || job.status === "partial")) {
          const msg = job.status === "completed"
            ? `Your ${job.niche} bundle is ready in My Library!`
            : `Your ${job.niche} bundle is ready (${job.completedCount}/${job.totalCount} products).`;
          toast({ title: "Bundle complete ✨", description: msg });
        }
        prevStatusRef.current[job.id] = job.status;
      });

      setJobs(fresh);
    } catch {}
  }, [toast]);

  // Initialise dismissed set from localStorage on mount
  useEffect(() => {
    setDismissedState(getDismissed());
  }, []);

  // Poll on mount and whenever there are active generating jobs
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const hasGenerating = jobs.some((j) => j.status === "generating");

  useEffect(() => {
    if (!hasGenerating) return;
    timerRef.current = setInterval(fetchJobs, POLL_INTERVAL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [hasGenerating, fetchJobs]);

  const visible = jobs.filter((j) => !dismissed.has(j.id));
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 px-4 pt-3 pb-0">
      {visible.map((job) => {
        const isGenerating = job.status === "generating";
        const isDone = job.status === "completed" || job.status === "partial";
        const isFailed = job.status === "failed";
        const isExpanded = expanded[job.id] ?? false;
        const progress = job.totalCount > 0 ? Math.round((job.completedCount / job.totalCount) * 100) : 0;

        return (
          <div
            key={job.id}
            className={`rounded-xl border text-sm overflow-hidden transition-all ${
              isDone
                ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                : isFailed
                  ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
                  : "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800"
            }`}
          >
            {/* Header row */}
            <div className="flex items-center gap-3 px-4 py-3">
              {isGenerating && <Loader2 className="w-4 h-4 shrink-0 animate-spin text-orange-500" />}
              {isDone && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />}
              {isFailed && <XCircle className="w-4 h-4 shrink-0 text-red-500" />}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-semibold truncate ${isDone ? "text-emerald-800 dark:text-emerald-200" : isFailed ? "text-red-700 dark:text-red-300" : "text-orange-800 dark:text-orange-200"}`}>
                    {isGenerating ? (
                      <>Generating <span className="italic">{job.niche}</span> bundle…</>
                    ) : isDone ? (
                      <><span className="italic">{job.niche}</span> bundle ready!</>
                    ) : (
                      <><span className="italic">{job.niche}</span> bundle failed</>
                    )}
                  </span>
                  {isGenerating && (
                    <span className="text-xs text-orange-600 dark:text-orange-400 tabular-nums shrink-0">
                      {job.completedCount}/{job.totalCount} products
                    </span>
                  )}
                </div>

                {isGenerating && (
                  <div className="mt-1.5 h-1.5 rounded-full bg-orange-200 dark:bg-orange-900 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-orange-500 transition-all duration-700"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {isDone && (
                  <Button asChild size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3">
                    <Link href="/dashboard/library">View Library →</Link>
                  </Button>
                )}
                <button
                  onClick={() => setExpanded((prev) => ({ ...prev, [job.id]: !prev[job.id] }))}
                  className={`p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 ${isDone ? "text-emerald-700 dark:text-emerald-300" : isFailed ? "text-red-600" : "text-orange-700 dark:text-orange-300"}`}
                  title={isExpanded ? "Collapse" : "Show details"}
                >
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => dismiss(job.id)}
                  className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-gray-400 hover:text-gray-600"
                  title="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Expanded product list */}
            {isExpanded && (
              <div className={`border-t px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-1.5 ${isDone ? "border-emerald-200 dark:border-emerald-800" : isFailed ? "border-red-200" : "border-orange-200 dark:border-orange-800"}`}>
                {job.products.map((p) => {
                  const label = FORMAT_LABELS[p.format ?? ""] ?? p.format ?? "Product";
                  const isProductDone = p.status === "draft";
                  const isProductFailed = p.status === "failed";
                  const isProductGenerating = p.status === "generating";
                  return (
                    <div key={p.id} className="flex items-center gap-1.5 text-xs">
                      {isProductGenerating && <Loader2 className="w-3 h-3 animate-spin text-orange-500 shrink-0" />}
                      {isProductDone && <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />}
                      {isProductFailed && <XCircle className="w-3 h-3 text-red-400 shrink-0" />}
                      {!isProductGenerating && !isProductDone && !isProductFailed && (
                        <Sparkles className="w-3 h-3 text-gray-400 shrink-0" />
                      )}
                      <span className={isProductDone ? "text-emerald-700 dark:text-emerald-300" : isProductFailed ? "text-red-600 dark:text-red-400" : "text-gray-600 dark:text-gray-400"}>
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
