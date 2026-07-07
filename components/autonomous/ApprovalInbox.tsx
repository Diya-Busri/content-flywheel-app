"use client";

/**
 * ApprovalInbox — Phase 7.0
 * ──────────────────────────────────────────────────────────────────────────────
 * Central inbox for all AI-generated content awaiting human review.
 * One-click Approve All / Reject All, or approve/reject individual items.
 */

import { useEffect, useState, useCallback } from "react";
import {
  Inbox,
  CheckCircle2,
  XCircle,
  Check,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import type { ApprovalItem, AutonomousDepartment } from "@/db/schema/launch-schema";

/* ─── Types ──────────────────────────────────────────────────────────────────── */

type Props = { launchId: string };

type Counts = {
  pending:  number;
  approved: number;
  rejected: number;
  total:    number;
};

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

const DEPT_COLORS: Record<AutonomousDepartment, string> = {
  research:  "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  marketing: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  design:    "bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-400",
  analytics: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  learning:  "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
  memory:    "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  system:    "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/* ─── Item Card ──────────────────────────────────────────────────────────────── */

function ItemCard({
  item,
  onApprove,
  onReject,
}: {
  item: ApprovalItem;
  onApprove: (id: string) => void;
  onReject:  (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const isPending  = item.status === "pending";
  const isApproved = item.status === "approved";
  const isRejected = item.status === "rejected";

  return (
    <div className={`rounded-lg border transition-all ${
      isPending
        ? "border-[#E5E7EB] dark:border-[#1E1E1E] bg-white dark:bg-[#0D0D0D]"
        : isApproved
        ? "border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/10"
        : "border-red-200 dark:border-red-900/40 bg-red-50/30 dark:bg-red-950/10 opacity-60"
    }`}>
      <div className="p-3">
        <div className="flex items-start gap-3">
          {/* Status icon */}
          <div className="mt-0.5 shrink-0">
            {isApproved && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
            {isRejected && <XCircle className="h-4 w-4 text-red-400" />}
            {isPending  && <div className="h-4 w-4 rounded-full border-2 border-gray-300 dark:border-gray-600" />}
          </div>

          <div className="flex-1 min-w-0">
            {/* Title + dept badge */}
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {item.title}
              </p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${DEPT_COLORS[item.department]}`}>
                {item.department}
              </span>
              {item.managerId && (
                <span className="rounded-full px-2 py-0.5 text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                  {item.managerId}
                </span>
              )}
            </div>

            {/* Preview */}
            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
              {item.preview}
            </p>

            {/* Expand payload */}
            {Object.keys(item.payload).length > 0 && (
              <button
                onClick={() => setExpanded(e => !e)}
                className="mt-1.5 flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {expanded ? "Hide details" : "View full content"}
              </button>
            )}
          </div>

          {/* Actions */}
          {isPending && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => onApprove(item.id)}
                className="flex items-center justify-center h-7 w-7 rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors"
                title="Approve"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onReject(item.id)}
                className="flex items-center justify-center h-7 w-7 rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
                title="Reject"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Expanded payload */}
        {expanded && (
          <pre className="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900 text-[10px] text-gray-600 dark:text-gray-400 overflow-auto max-h-48 font-mono leading-relaxed">
            {JSON.stringify(item.payload, null, 2)}
          </pre>
        )}

        <div className="mt-1.5 text-[10px] text-gray-400">
          Generated {formatTime(item.generatedAt)}
          {item.reviewedAt && ` · Reviewed ${formatTime(item.reviewedAt)}`}
          {item.batchSize && item.batchSize > 1 && ` · ${item.batchSize} pieces`}
        </div>
      </div>
    </div>
  );
}

/* ─── Component ──────────────────────────────────────────────────────────────── */

export function ApprovalInbox({ launchId }: Props) {
  const [items,    setItems]    = useState<ApprovalItem[]>([]);
  const [counts,   setCounts]   = useState<Counts>({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [loading,  setLoading]  = useState(true);
  const [acting,   setActing]   = useState(false);
  const [filter,   setFilter]   = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const { toast } = useToast();

  const load = useCallback(async () => {
    try {
      const res  = await fetch(`/api/projects/${launchId}/approval`);
      const data = await res.json() as { items: ApprovalItem[]; counts: Counts };
      setItems(data.items ?? []);
      setCounts(data.counts ?? { pending: 0, approved: 0, rejected: 0, total: 0 });
    } finally {
      setLoading(false);
    }
  }, [launchId]);

  useEffect(() => { void load(); }, [load]);

  async function bulkAction(action: "approve_all" | "reject_all") {
    setActing(true);
    try {
      const res  = await fetch(`/api/projects/${launchId}/approval`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action }),
      });
      const data = await res.json() as { items: ApprovalItem[]; counts: Counts };
      setItems(data.items ?? []);
      setCounts(data.counts ?? counts);
      toast({
        title: action === "approve_all" ? "All approved" : "All rejected",
        description: `${counts.pending} item${counts.pending !== 1 ? "s" : ""} ${action === "approve_all" ? "approved" : "rejected"}.`,
      });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setActing(false);
    }
  }

  async function singleAction(action: "approve" | "reject", id: string) {
    try {
      const res  = await fetch(`/api/projects/${launchId}/approval`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action, ids: [id] }),
      });
      const data = await res.json() as { items: ApprovalItem[]; counts: Counts };
      setItems(data.items ?? []);
      setCounts(data.counts ?? counts);
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  }

  const visible = filter === "all"
    ? items
    : items.filter(i => i.status === filter);

  if (loading) {
    return (
      <div className="rounded-xl border border-[#E5E7EB] dark:border-[#1E1E1E] bg-white dark:bg-[#111] p-5 animate-pulse">
        <div className="h-5 w-48 bg-gray-200 dark:bg-gray-800 rounded mb-3" />
        <div className="space-y-2">
          {[0,1,2].map(i => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#E5E7EB] dark:border-[#1E1E1E] bg-white dark:bg-[#111] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#F0F0F0] dark:border-[#1E1E1E]">
        <div className="flex items-center gap-2">
          <Inbox className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-semibold text-gray-900 dark:text-white">Approval Inbox</span>
          {counts.pending > 0 && (
            <span className="rounded-full bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5">
              {counts.pending}
            </span>
          )}
        </div>

        {counts.pending > 0 && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/30 gap-1"
              disabled={acting}
              onClick={() => void bulkAction("reject_all")}
            >
              <X className="h-3 w-3" />
              Reject All
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs bg-emerald-500 hover:bg-emerald-600 gap-1"
              disabled={acting}
              onClick={() => void bulkAction("approve_all")}
            >
              {acting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Approve All
            </Button>
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Filter tabs */}
        <div className="flex items-center gap-1">
          <Filter className="h-3.5 w-3.5 text-gray-400 mr-1" />
          {(["pending", "approved", "rejected", "all"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                filter === f
                  ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== "all" && (
                <span className="ml-1 opacity-70">
                  {f === "pending" ? counts.pending : f === "approved" ? counts.approved : counts.rejected}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Items */}
        {visible.length === 0 ? (
          <div className="text-center py-8">
            <Inbox className="h-8 w-8 text-gray-300 dark:text-gray-700 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {filter === "pending" ? "No pending items — inbox is clear." : `No ${filter} items.`}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                onApprove={id => void singleAction("approve", id)}
                onReject={id => void singleAction("reject", id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
