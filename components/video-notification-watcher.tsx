"use client";

/**
 * VideoNotificationWatcher
 * ─────────────────────────
 * Runs in the background (mounted in the dashboard layout) and polls for any
 * in-progress avatar promo videos that were kicked off in the product editor.
 *
 * Flow:
 *  1. AvatarVideoPanel calls `registerPendingVideo(...)` when a job starts.
 *  2. This component reads pending jobs from localStorage every POLL_MS.
 *  3. When a job completes it fires a toast + browser notification (if permitted)
 *     and removes the job from storage.
 *
 * Storage key: "cf_pending_videos"
 * Value: JSON array of PendingVideo
 */

import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";

const STORAGE_KEY = "cf_pending_videos";
const POLL_MS = 8000; // 8 s between checks
const MAX_ATTEMPTS = 45; // ~6 min before giving up

export type PendingVideo = {
  productId: string;
  jobId: string;
  provider: string;
  productTitle: string;
  attempts: number;
  startedAt: number; // epoch ms
};

/** Call this from AvatarVideoPanel when a new async job starts. */
export function registerPendingVideo(job: Omit<PendingVideo, "attempts" | "startedAt">) {
  try {
    const existing = getPendingVideos();
    // Replace if same productId already tracked
    const filtered = existing.filter((v) => v.productId !== job.productId);
    filtered.push({ ...job, attempts: 0, startedAt: Date.now() });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch {
    // localStorage unavailable (SSR guard)
  }
}

function getPendingVideos(): PendingVideo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PendingVideo[];
  } catch {
    return [];
  }
}

function setPendingVideos(videos: PendingVideo[]) {
  try {
    if (videos.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(videos));
    }
  } catch {}
}

export function VideoNotificationWatcher() {
  const { toast } = useToast();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const poll = async () => {
      const jobs = getPendingVideos();
      if (jobs.length === 0) {
        timerRef.current = setTimeout(poll, POLL_MS);
        return;
      }

      const updated: PendingVideo[] = [];

      await Promise.allSettled(
        jobs.map(async (job) => {
          if (job.attempts >= MAX_ATTEMPTS) {
            // Silently drop timed-out jobs
            return;
          }
          try {
            const res = await fetch(
              `/api/products/${job.productId}/avatar-video/status?videoId=${encodeURIComponent(job.jobId)}&provider=${encodeURIComponent(job.provider)}`
            );
            const data = (await res.json()) as { status?: string; videoUrl?: string };

            if (data.status === "completed") {
              // Fire in-app toast
              toast({
                title: "🎉 Promo video ready!",
                description: (
                  <span>
                    <strong>{job.productTitle}</strong> — your avatar video has finished.{" "}
                    <Link
                      href={`/dashboard/digital-products/${job.productId}/edit?tab=videos`}
                      className="underline font-medium"
                    >
                      View it now →
                    </Link>
                  </span>
                ) as unknown as string,
                duration: 8000,
              });

              // Browser notification (if user has granted permission)
              if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                new Notification("Content Flywheel — Video Ready!", {
                  body: `Your promo video for "${job.productTitle}" is ready.`,
                  icon: "/favicon.ico",
                });
              }

              // Don't re-add to updated → removes from storage
            } else if (data.status === "failed") {
              toast({
                title: "Video generation failed",
                description: `"${job.productTitle}" — check the Videos tab for details.`,
                variant: "destructive",
              });
              // Don't re-add → removes from storage
            } else {
              // Still processing — keep tracking
              updated.push({ ...job, attempts: job.attempts + 1 });
            }
          } catch {
            // Network error — keep tracking
            updated.push({ ...job, attempts: job.attempts + 1 });
          }
        })
      );

      setPendingVideos(updated);
      timerRef.current = setTimeout(poll, POLL_MS);
    };

    timerRef.current = setTimeout(poll, POLL_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast]);

  return null; // Pure background effect, no UI
}
