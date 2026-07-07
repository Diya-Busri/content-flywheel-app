/**
 * WorkspaceStageCard
 * ─────────────────────────────────────────────────────────────
 * Reusable card component for the AI Execution Workspace.
 * Designed to also serve as the Project Dashboard card in Phase 2.
 *
 * Renders a single completed (or failed/pending) pipeline stage as a
 * self-contained review card with:
 *   - Status badge (Queued / Running / Complete / Failed)
 *   - Timestamp of completion
 *   - AI summary sentence
 *   - Stage-specific preview widget (passed as children)
 *   - Action bar: View · Edit · Regenerate
 *
 * Intentionally has zero routing imports — all navigation is done via
 * plain href strings or callbacks, so the card works in any React context.
 */
"use client";

import { useState } from "react";
import {
  CheckCircle2, Loader2, Clock, XCircle, RefreshCw,
  ExternalLink, Pencil, Eye,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────────────────────── */

export type WorkspaceCardStatus = "queued" | "running" | "complete" | "failed";

export interface WorkspaceStageCardProps {
  /** Unique stage identifier (e.g. "research", "product") */
  id: string;
  /** Display emoji for the stage */
  emoji: string;
  /** Short human label (e.g. "Research") */
  label: string;
  /** Full agent label (e.g. "Research Agent") */
  agentLabel: string;
  /** One-line description of the stage */
  description: string;

  status: WorkspaceCardStatus;

  /** 2–3 sentence AI summary of what this stage produced */
  summary?: string;

  /** ISO timestamp when stage completed */
  completedAt?: string;

  /** Where the View button links (opens same tab unless externalView=true) */
  viewHref?: string;
  /** Opens view link in a new tab */
  externalView?: boolean;

  /** Where the Edit button links */
  editHref?: string;

  /** Called when user clicks Regenerate — parent handles redirect logic */
  onRegenerate?: () => void;
  /** Shows a spinner on the Regenerate button while the parent is working */
  isRegenerating?: boolean;

  /**
   * Stage-specific preview widget.
   * Rendered inside the card body, between the summary and the action bar.
   */
  children?: React.ReactNode;
}

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function formatRelativeTime(iso: string): string {
  try {
    const diff   = Date.now() - new Date(iso).getTime();
    const mins   = Math.floor(diff / 60_000);
    const hours  = Math.floor(diff / 3_600_000);
    const days   = Math.floor(diff / 86_400_000);

    if (mins  <  2) return "just now";
    if (mins  < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  } catch {
    return "–";
  }
}

/* ─── Status visuals ─────────────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: WorkspaceCardStatus }) {
  const cfg = {
    queued:   { label: "Queued",   cls: "bg-muted/60 text-muted-foreground",                       Icon: Clock       },
    running:  { label: "Running",  cls: "bg-blue-500/10 text-blue-500 border border-blue-500/20",  Icon: Loader2     },
    complete: { label: "Complete", cls: "bg-green-500/10 text-green-500 border border-green-500/20", Icon: CheckCircle2 },
    failed:   { label: "Failed",   cls: "bg-red-500/10 text-red-400 border border-red-500/20",     Icon: XCircle     },
  }[status];

  const { label, cls, Icon } = cfg;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cls}`}>
      <Icon className={`w-2.5 h-2.5 shrink-0 ${status === "running" ? "animate-spin" : ""}`} />
      {label}
    </span>
  );
}

/* ─── Border / background per status ────────────────────────────────────────── */

function cardStyles(status: WorkspaceCardStatus): { border: string; bg: string } {
  return {
    queued:   { border: "border-border/40",       bg: "bg-card/40"             },
    running:  { border: "border-blue-500/30",     bg: "bg-blue-500/[0.02]"     },
    complete: { border: "border-border/50",        bg: "bg-card"                },
    failed:   { border: "border-red-500/30",       bg: "bg-red-500/[0.02]"      },
  }[status];
}

/* ─── Main component ─────────────────────────────────────────────────────────── */

export function WorkspaceStageCard({
  id,
  emoji,
  label,
  agentLabel,
  description,
  status,
  summary,
  completedAt,
  viewHref,
  externalView = false,
  editHref,
  onRegenerate,
  isRegenerating = false,
  children,
}: WorkspaceStageCardProps) {
  const [regenConfirm, setRegenConfirm] = useState(false);
  const { border, bg } = cardStyles(status);

  const isComplete = status === "complete";
  const isFailed   = status === "failed";
  const isWaiting  = status === "queued";

  return (
    <div
      className={`rounded-2xl border overflow-hidden flex flex-col transition-all duration-300 ${border} ${bg}`}
      role="article"
      aria-label={`${agentLabel} — ${status}`}
    >
      {/* ── Card header ────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 px-5 py-4 border-b border-inherit">
        <span
          className={`text-xl leading-none shrink-0 mt-0.5 ${isWaiting ? "opacity-30 grayscale" : ""}`}
          aria-hidden
        >
          {isComplete ? "✅" : isFailed ? "❌" : emoji}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <h3 className={`text-[13px] font-bold leading-tight ${isWaiting ? "text-muted-foreground/40" : "text-foreground"}`}>
              {agentLabel}
            </h3>
            <StatusBadge status={status} />
          </div>
          <p className={`text-[11px] leading-snug ${isWaiting ? "text-muted-foreground/30" : "text-muted-foreground/60"}`}>
            {description}
          </p>
        </div>

        {/* Timestamp */}
        {completedAt && isComplete && (
          <span className="shrink-0 text-[10px] text-muted-foreground/40 mt-0.5 tabular-nums">
            {formatRelativeTime(completedAt)}
          </span>
        )}
      </div>

      {/* ── Body: summary + preview ─────────────────────────────────── */}
      {(isComplete || isFailed) && (
        <div className="flex-1 px-5 py-4 space-y-3">
          {/* AI summary */}
          {summary && (
            <p className="text-[12px] text-muted-foreground/80 leading-relaxed">
              {summary}
            </p>
          )}

          {isFailed && !summary && (
            <p className="text-[12px] text-red-400/80 leading-relaxed">
              This stage failed. Check the execution logs and click Regenerate to retry.
            </p>
          )}

          {/* Stage-specific preview widget */}
          {children && (
            <div className="mt-1">
              {children}
            </div>
          )}
        </div>
      )}

      {/* Queued / Running placeholder body */}
      {isWaiting && (
        <div className="flex-1 px-5 py-4 flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-muted-foreground/25 shrink-0" />
          <span className="text-[12px] text-muted-foreground/30">
            Waiting for previous stages to complete
          </span>
        </div>
      )}

      {status === "running" && (
        <div className="flex-1 px-5 py-4 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 text-blue-500/60 animate-spin shrink-0" />
          <span className="text-[12px] text-blue-500/60">
            Agent is working...
          </span>
        </div>
      )}

      {/* ── Action bar ──────────────────────────────────────────────── */}
      <div className="px-5 py-3 border-t border-inherit bg-muted/[0.03] flex items-center gap-2 flex-wrap">

        {/* View */}
        {viewHref && isComplete && (
          <a
            href={viewHref}
            {...(externalView ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/60 hover:bg-muted/80 text-[11px] font-semibold text-foreground/80 transition-colors"
          >
            <Eye className="w-3 h-3 shrink-0" />
            View
            {externalView && <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-50" />}
          </a>
        )}

        {/* Edit */}
        {editHref && isComplete && (
          <a
            href={editHref}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/60 hover:bg-muted/80 text-[11px] font-semibold text-foreground/80 transition-colors"
          >
            <Pencil className="w-3 h-3 shrink-0" />
            Edit
          </a>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Regenerate */}
        {onRegenerate && (isComplete || isFailed) && (
          <>
            {regenConfirm ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground/60">Re-run this stage?</span>
                <button
                  onClick={() => {
                    setRegenConfirm(false);
                    onRegenerate();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-[10px] font-bold text-white transition-colors"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setRegenConfirm(false)}
                  className="px-2.5 py-1 rounded-lg bg-muted/60 hover:bg-muted/80 text-[10px] font-semibold text-foreground/60 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setRegenConfirm(true)}
                disabled={isRegenerating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 bg-card/40 hover:bg-muted/40 text-[11px] font-semibold text-muted-foreground/60 hover:text-foreground/70 transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                <RefreshCw className={`w-3 h-3 shrink-0 ${isRegenerating ? "animate-spin" : ""}`} />
                Regenerate
              </button>
            )}
          </>
        )}
      </div>

      {/* Stage ID for automated testing */}
      <span className="sr-only" data-stage-id={id} />
    </div>
  );
}
