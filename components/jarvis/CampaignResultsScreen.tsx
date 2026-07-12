"use client";

import Link from "next/link";
import { CheckCircle2, ExternalLink, XCircle, RotateCcw, Video, LayoutGrid, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { JarvisRunDTO } from "@/hooks/useJarvisRun";
import type { ProposedAsset } from "@/db/schema/jarvis-schema";

const TYPE_ICON: Record<ProposedAsset["type"], typeof Video> = {
  video_script: Video,
  carousel: LayoutGrid,
  email: Mail,
};

function destinationFor(asset: ProposedAsset): { label: string; href: string } {
  if (asset.type === "email") return { label: "Open in Email Marketing", href: "/dashboard/email-marketing" };
  return { label: "Open in Library", href: "/dashboard/library" };
}

/**
 * Campaign results screen — shown once a run completes. Only lists assets
 * that genuinely have a savedRefId (i.e. save_content_campaign actually
 * returned success for them); anything the user deselected, or that failed
 * to save, is shown honestly in its own section rather than folded in.
 */
export function CampaignResultsScreen({ run, onStartNew }: { run: JarvisRunDTO; onStartNew: () => void }) {
  const saved = run.assets.filter((a) => a.status === "saved");
  const rejected = run.assets.filter((a) => a.status === "rejected");
  const failed = run.assets.filter((a) => a.status === "approved" && a.saveError);

  return (
    <Card className="border-gray-200 dark:border-gray-800">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <CardTitle className="text-base font-semibold">Campaign saved</CardTitle>
        </div>
        {run.finalSummary && <p className="text-sm text-gray-500 dark:text-gray-400">{run.finalSummary.message}</p>}
      </CardHeader>
      <CardContent className="space-y-5">
        {saved.length > 0 && (
          <div className="space-y-2">
            {saved.map((asset) => {
              const Icon = TYPE_ICON[asset.type];
              const dest = destinationFor(asset);
              return (
                <div
                  key={asset.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-[#141414]"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0 text-orange-500" />
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                      {asset.type === "email" ? asset.subject : asset.title}
                    </p>
                  </div>
                  <Link
                    href={dest.href}
                    className="flex shrink-0 items-center gap-1 text-sm font-medium text-orange-600 hover:underline dark:text-orange-400"
                  >
                    {dest.label}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              );
            })}
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
      </CardContent>
    </Card>
  );
}
