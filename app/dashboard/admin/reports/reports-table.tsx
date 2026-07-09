"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { messageTime } from "@/components/messaging/message-time";

export interface ReportRow {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  reportedByUserId: string;
  createdAt: string;
  preview: string;
  kind: "post" | "comment";
  postId: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  reviewed: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  dismissed: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300",
  actioned: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
};

export function ReportsTable({ initialReports }: { initialReports: ReportRow[] }) {
  const [reports, setReports] = useState(initialReports);
  const [busy, setBusy] = useState<string | null>(null);

  async function update(reportId: string, status: string) {
    setBusy(reportId);
    try {
      const res = await fetch("/api/admin/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, status }),
      });
      if (res.ok) {
        setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, status } : r)));
      }
    } finally {
      setBusy(null);
    }
  }

  if (reports.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
        No reports. The community is behaving!
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reports.map((r) => (
        <div key={r.id} className="rounded-xl border bg-card p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium capitalize text-foreground">
              {r.reason}
            </span>
            <span className="text-[11px] capitalize text-muted-foreground">{r.kind}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLES[r.status] ?? STATUS_STYLES.pending}`}>
              {r.status}
            </span>
            <span className="ml-auto text-[11px] text-muted-foreground">{messageTime(r.createdAt)}</span>
          </div>
          <p className="text-sm text-foreground">{r.preview || "(no content)"}</p>
          {r.details && <p className="mt-1 text-xs italic text-muted-foreground">“{r.details}”</p>}
          <p className="mt-1 text-[11px] text-muted-foreground">Reported by: {r.reportedByUserId}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            {r.postId && (
              <Link href={`/dashboard/academy/community/${r.postId}`}>
                <Button size="sm" variant="outline">View Post</Button>
              </Link>
            )}
            <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => update(r.id, "dismissed")}>
              Dismiss
            </Button>
            <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => update(r.id, "reviewed")}>
              Mark Reviewed
            </Button>
            <Button size="sm" disabled={busy === r.id} onClick={() => update(r.id, "actioned")}>
              Action Taken
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
