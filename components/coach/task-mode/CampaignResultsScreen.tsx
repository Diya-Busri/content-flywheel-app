"use client";

import Link from "next/link";
import { CheckCircle2, ExternalLink, XCircle, RotateCcw, Library, Mail as MailIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TaskRunDTO } from "@/hooks/useTaskRun";
import type { ContentAssetType } from "@/db/schema/jarvis-schema";
import { ASSET_TYPE_META } from "./asset-meta";
import { CampaignSummary } from "./CampaignSummary";

/**
 * Campaign results screen — shown once a run completes. Only lists assets
 * that genuinely have a savedRefId (i.e. save_content_campaign actually
 * returned success for them); anything the user deselected, or that failed
 * to save, is shown honestly in its own section rather than folded in.
 *
 * Leads with a clear "what's saved" summary, then clear next-action buttons
 * (open the destinations that actually received something) rather than a
 * flat list of per-asset links.
 */
export function CampaignResultsScreen({ run, onStartNew }: { run: TaskRunDTO; onStartNew: () => void }) {
  const saved = run.assets.filter((a) => a.status === "saved");
  const rejected = run.assets.filter((a) => a.status === "rejected");
  const failed = run.assets.filter((a) => a.status === "approved" && a.saveError);

  const savedCounts = saved.reduce<Partial<Record<ContentAssetType, number>>>((acc, a) => {
    acc[a.type] = (acc[a.type] ?? 0) + 1;
    return acc;
  }, {});

  const savedToLibrary = saved.filter((a) => a.type === "video_script" || a.type === "carousel").length;
  const savedToEmail = saved.filter((a) => a.type === "email").length;

  return (
    <div className="space-y-4">
      <CampaignSummary
        eyebrow="Campaign saved"
        headline={run.finalSummary?.message ?? "Your campaign has been saved."}
        counts={savedCounts}
        tone="green"
      />

      {(savedToLibrary > 0 || savedToEmail > 0) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {savedToLibrary > 0 && (
            <Link
              href="/dashboard/library"
              className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-orange-300 hover:bg-orange-50 dark:border-gray-800 dark:bg-[#141414] dark:hover:border-orange-800 dark:hover:bg-orange-950/20"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-50 dark:bg-orange-950/40">
                  <Library className="h-4 w-4 text-orange-500" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Open in Library</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{savedToLibrary} script{savedToLibrary === 1 ? "" : "s"} saved as drafts</p>
                </div>
              </div>
              <ExternalLink className="h-4 w-4 shrink-0 text-gray-400" />
            </Link>
          )}
          {savedToEmail > 0 && (
            <Link
              href="/dashboard/email-marketing"
              className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-orange-300 hover:bg-orange-50 dark:border-gray-800 dark:bg-[#141414] dark:hover:border-orange-800 dark:hover:bg-orange-950/20"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-50 dark:bg-orange-950/40">
                  <MailIcon className="h-4 w-4 text-orange-500" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Open in Email Marketing</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{savedToEmail} email{savedToEmail === 1 ? "" : "s"} saved as draft{savedToEmail === 1 ? "" : "s"}, not sent</p>
                </div>
              </div>
              <ExternalLink className="h-4 w-4 shrink-0 text-gray-400" />
            </Link>
          )}
        </div>
      )}

      {saved.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800">
          <div className="border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">What was saved</p>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {saved.map((asset) => {
              const Icon = ASSET_TYPE_META[asset.type].icon;
              return (
                <div key={asset.id} className="flex items-center gap-3 px-4 py-2.5">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
                  <Icon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  <p className="min-w-0 truncate text-sm text-gray-700 dark:text-gray-300">
                    {asset.type === "email" ? asset.subject : asset.title}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {failed.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-red-500">Failed to save</p>
          <div className="space-y-1.5">
            {failed.map((asset) => (
              <div key={asset.id} className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <XCircle className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{asset.type === "email" ? asset.subject : asset.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {rejected.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Not saved (deselected)</p>
          <div className="space-y-1 text-sm text-gray-500 dark:text-gray-400">
            {rejected.map((asset) => (
              <p key={asset.id} className="truncate">{asset.type === "email" ? asset.subject : asset.title}</p>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end border-t border-gray-100 pt-4 dark:border-gray-800">
        <Button onClick={onStartNew} variant="outline" className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Start new task
        </Button>
      </div>
    </div>
  );
}
