"use client";

/**
 * GrowthTaskCard — Phase 6
 * ──────────────────────────────────────────────────────────────────────────────
 * Renders a single Growth Mode task with:
 *  • Type icon + priority badge
 *  • Title, description, reasoning
 *  • Estimated impact (qualitative)
 *  • Platform tag (if applicable)
 *  • Reference asset link (if applicable)
 *  • Suggested action callout
 *  • Mark done / dismiss buttons
 */

import { useState } from "react";
import {
  Lightbulb, FlaskConical, Edit3, TrendingDown, Compass, Megaphone,
  Package, Repeat2, MessageCircle, CheckCircle2, X, ChevronDown, ChevronUp,
  ArrowRight, Zap,
} from "lucide-react";
import type { GrowthTask, GrowthTaskType, GrowthTaskPriority } from "@/db/schema/launch-schema";

/* ─── Config ─────────────────────────────────────────────────────────────────── */

const TYPE_CONFIG: Record<GrowthTaskType, { icon: React.ReactNode; label: string; color: string; bg: string }> = {
  content_idea:    { icon: <Lightbulb className="w-3 h-3" />,     label: "Content Idea",    color: "text-pink-400",    bg: "bg-pink-500/10"    },
  ab_test:         { icon: <FlaskConical className="w-3 h-3" />,  label: "A/B Test",        color: "text-purple-400",  bg: "bg-purple-500/10"  },
  improve_copy:    { icon: <Edit3 className="w-3 h-3" />,         label: "Improve Copy",    color: "text-blue-400",    bg: "bg-blue-500/10"    },
  fix_declining:   { icon: <TrendingDown className="w-3 h-3" />,  label: "Fix Declining",   color: "text-red-400",     bg: "bg-red-500/10"     },
  new_opportunity: { icon: <Compass className="w-3 h-3" />,       label: "New Opportunity", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  campaign:        { icon: <Megaphone className="w-3 h-3" />,     label: "Campaign",        color: "text-orange-400",  bg: "bg-orange-500/10"  },
  product_improve: { icon: <Package className="w-3 h-3" />,       label: "Product",         color: "text-amber-400",   bg: "bg-amber-500/10"   },
  repost:          { icon: <Repeat2 className="w-3 h-3" />,       label: "Repurpose",       color: "text-cyan-400",    bg: "bg-cyan-500/10"    },
  engagement:      { icon: <MessageCircle className="w-3 h-3" />, label: "Engagement",      color: "text-indigo-400",  bg: "bg-indigo-500/10"  },
};

const PRIORITY_CONFIG: Record<GrowthTaskPriority, { label: string; color: string; bg: string; dot: string }> = {
  critical: { label: "Critical", color: "text-red-400",    bg: "bg-red-500/15",    dot: "bg-red-400 animate-pulse" },
  high:     { label: "High",     color: "text-orange-400", bg: "bg-orange-500/10", dot: "bg-orange-400" },
  medium:   { label: "Medium",   color: "text-amber-400",  bg: "bg-amber-500/10",  dot: "bg-amber-400"  },
  low:      { label: "Low",      color: "text-muted-foreground/50", bg: "bg-muted/20", dot: "bg-muted-foreground/30" },
};

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube",
  x: "X / Twitter", linkedin: "LinkedIn", email: "Email", seo: "SEO",
};

/* ─── Props ──────────────────────────────────────────────────────────────────── */

interface GrowthTaskCardProps {
  task:      GrowthTask;
  onUpdate:  (taskId: string, status: "done" | "dismissed") => Promise<void>;
}

/* ─── Component ──────────────────────────────────────────────────────────────── */

export function GrowthTaskCard({ task, onUpdate }: GrowthTaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [busy,     setBusy]     = useState(false);

  const type     = TYPE_CONFIG[task.type]     ?? TYPE_CONFIG.content_idea;
  const priority = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;

  const handle = async (status: "done" | "dismissed") => {
    setBusy(true);
    await onUpdate(task.id, status);
    setBusy(false);
  };

  if (task.status === "done" || task.status === "dismissed") {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 opacity-40">
        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
        <p className="flex-1 text-[11px] text-muted-foreground/60 line-through">{task.title}</p>
        <span className="text-[9px] text-muted-foreground/30">{task.status}</span>
      </div>
    );
  }

  return (
    <div className={[
      "border-l-2 transition-colors",
      task.priority === "critical" ? "border-red-500/60" :
      task.priority === "high"     ? "border-orange-500/60" :
      task.priority === "medium"   ? "border-amber-500/40" :
                                     "border-muted/20",
    ].join(" ")}>
      {/* ── Header row ── */}
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Type icon */}
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${type.bg} ${type.color}`}>
          {type.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${priority.bg} ${priority.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${priority.dot}`} />
              {priority.label}
            </span>
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold ${type.bg} ${type.color}`}>
              {type.label}
            </span>
            {task.managerId && (
              <span className="text-[9px] text-muted-foreground/40 font-medium">
                {PLATFORM_LABELS[task.managerId] ?? task.managerId}
              </span>
            )}
          </div>
          <p className="text-[12px] font-bold text-foreground leading-snug">{task.title}</p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5 leading-relaxed line-clamp-2">{task.description}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-6 h-6 rounded-lg bg-muted/20 hover:bg-muted/40 flex items-center justify-center transition-colors"
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded
              ? <ChevronUp className="w-3 h-3 text-muted-foreground/50" />
              : <ChevronDown className="w-3 h-3 text-muted-foreground/50" />}
          </button>
          <button
            disabled={busy}
            onClick={() => void handle("done")}
            title="Mark done"
            className="w-6 h-6 rounded-lg bg-green-500/10 hover:bg-green-500/25 flex items-center justify-center transition-colors"
          >
            <CheckCircle2 className="w-3 h-3 text-green-500" />
          </button>
          <button
            disabled={busy}
            onClick={() => void handle("dismissed")}
            title="Dismiss"
            className="w-6 h-6 rounded-lg bg-muted/20 hover:bg-muted/40 flex items-center justify-center transition-colors"
          >
            <X className="w-3 h-3 text-muted-foreground/50" />
          </button>
        </div>
      </div>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div className="px-4 pb-3 space-y-2 border-t border-border/20 pt-3">
          {/* Reasoning */}
          {task.reasoning && (
            <div className="flex items-start gap-2">
              <Zap className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider mb-0.5">Why this task</p>
                <p className="text-[11px] text-muted-foreground/70 leading-relaxed">{task.reasoning}</p>
              </div>
            </div>
          )}

          {/* Estimated impact */}
          {task.estimatedImpact && (
            <div className="flex items-start gap-2">
              <ArrowRight className="w-3 h-3 text-green-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider mb-0.5">Expected impact</p>
                <p className="text-[11px] text-muted-foreground/70 leading-relaxed">{task.estimatedImpact}</p>
              </div>
            </div>
          )}

          {/* Reference asset */}
          {task.referenceAsset && (
            <div className="px-3 py-2 rounded-lg bg-muted/20 border border-border/30">
              <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-wider mb-0.5">Build on</p>
              <p className="text-[11px] text-foreground/70">{task.referenceAsset}</p>
            </div>
          )}

          {/* Suggested action */}
          {task.suggestedAction && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-orange-500/5 border border-orange-500/15">
              <Zap className="w-3 h-3 text-orange-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-0.5">Next step</p>
                <p className="text-[11px] text-foreground/80 leading-relaxed">{task.suggestedAction}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
