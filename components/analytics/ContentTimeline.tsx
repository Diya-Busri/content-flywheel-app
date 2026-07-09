"use client";

/**
 * ContentTimeline — Phase 5.3
 * ──────────────────────────────────────────────────────────────────────────────
 * Visualises the full lifecycle of a published content item:
 *   Created → Queued → Published → Analysed → Lessons → Memory Updated
 *
 * Used inside the Marketing Department "Published" tab for each item.
 * Also renders a compact inline variant for embedding in other views.
 */

import type {
  PublishedItem,
  PostAnalytics,
  MarketingManagerId,
} from "@/db/schema/launch-schema";
import { CheckCircle2, Clock, Loader2, Zap, BookOpen, Brain, Upload, Sparkles } from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────────────────────── */

type TimelineStage =
  | "created"
  | "queued"
  | "published"
  | "analysed"
  | "lessons"
  | "memory";

type StageState = "complete" | "active" | "pending";

type TimelineNode = {
  stage:     TimelineStage;
  label:     string;
  detail?:   string;
  timestamp?: string;
  state:     StageState;
};

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

const STAGE_ICONS: Record<TimelineStage, React.ReactNode> = {
  created:   <Sparkles className="w-3 h-3" />,
  queued:    <Clock className="w-3 h-3" />,
  published: <Upload className="w-3 h-3" />,
  analysed:  <Zap className="w-3 h-3" />,
  lessons:   <BookOpen className="w-3 h-3" />,
  memory:    <Brain className="w-3 h-3" />,
};

const STAGE_COLORS: Record<StageState, { dot: string; line: string; text: string; bg: string }> = {
  complete: { dot: "bg-green-500",           line: "bg-green-500/40",       text: "text-green-400",       bg: "bg-green-500/10" },
  active:   { dot: "bg-orange-500 animate-pulse", line: "bg-orange-500/20", text: "text-orange-400",      bg: "bg-orange-500/10" },
  pending:  { dot: "bg-muted/30",            line: "bg-muted/15",           text: "text-muted-foreground/30", bg: "bg-muted/10" },
};

function fmtTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/* ─── Build nodes from data ──────────────────────────────────────────────────── */

function buildNodes(
  publishedItem: PublishedItem,
  postAnalytics: PostAnalytics | undefined,
  hasLessons:    boolean,
  hasMemoryUpdate: boolean,
): TimelineNode[] {
  const nodes: TimelineNode[] = [];

  // Created — we use publishedAt as proxy (no separate createdAt on PublishedItem)
  nodes.push({
    stage:     "created",
    label:     "Content created",
    detail:    publishedItem.content.slice(0, 60) + (publishedItem.content.length > 60 ? "…" : ""),
    timestamp: publishedItem.publishedAt, // closest we have
    state:     "complete",
  });

  // Published
  nodes.push({
    stage:     "published",
    label:     "Published",
    detail:    publishedItem.publishedUrl ? `Live at ${publishedItem.publishedUrl}` : "Content is live",
    timestamp: publishedItem.publishedAt,
    state:     "complete",
  });

  // Analysed
  if (postAnalytics?.analysedAt) {
    const topInsight = postAnalytics.insights.find(i => i.type === "win") ?? postAnalytics.insights[0];
    nodes.push({
      stage:     "analysed",
      label:     "AI analysis complete",
      detail:    topInsight ? `"${topInsight.text.slice(0, 70)}…"` : `${postAnalytics.insights.length} insights generated`,
      timestamp: postAnalytics.analysedAt,
      state:     "complete",
    });
  } else if (postAnalytics) {
    nodes.push({
      stage:   "analysed",
      label:   "Analysing…",
      detail:  "AI is reviewing performance metrics",
      state:   "active",
    });
  } else {
    nodes.push({
      stage:  "analysed",
      label:  "Awaiting analysis",
      detail: "AI will analyse once synced",
      state:  "pending",
    });
  }

  // Lessons
  if (hasLessons) {
    nodes.push({
      stage:  "lessons",
      label:  "Lessons extracted",
      detail: "Reusable findings added to learning library",
      state:  "complete",
    });
  } else {
    nodes.push({
      stage:  "lessons",
      label:  "Extracting lessons",
      detail: "Needs 2+ analysed posts to run",
      state:  postAnalytics?.analysedAt ? "active" : "pending",
    });
  }

  // Memory updated
  if (hasMemoryUpdate) {
    nodes.push({
      stage:  "memory",
      label:  "Business Memory updated",
      detail: "Insights injected into future content prompts",
      state:  "complete",
    });
  } else {
    nodes.push({
      stage:  "memory",
      label:  "Memory update pending",
      detail: "Will update after lessons extracted",
      state:  "pending",
    });
  }

  return nodes;
}

/* ─── Main component ─────────────────────────────────────────────────────────── */

interface ContentTimelineProps {
  publishedItem:  PublishedItem;
  postAnalytics?: PostAnalytics;
  managerId:      MarketingManagerId;
  hasLessons:     boolean;
  hasMemoryUpdate: boolean;
  compact?:        boolean;
}

export function ContentTimeline({
  publishedItem,
  postAnalytics,
  hasLessons,
  hasMemoryUpdate,
  compact = false,
}: ContentTimelineProps) {
  const nodes = buildNodes(publishedItem, postAnalytics, hasLessons, hasMemoryUpdate);

  if (compact) {
    /* ── Compact: horizontal pill strip ── */
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {nodes.map((node, i) => {
          const c = STAGE_COLORS[node.state];
          return (
            <span
              key={node.stage}
              title={node.detail}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${c.bg} ${c.text}`}
            >
              {node.state === "active"
                ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                : node.state === "complete"
                  ? <CheckCircle2 className="w-2.5 h-2.5" />
                  : <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40" />}
              {node.label}
              {i < nodes.length - 1 && <span className="opacity-20 ml-0.5">›</span>}
            </span>
          );
        })}
      </div>
    );
  }

  /* ── Full vertical timeline ── */
  return (
    <div className="space-y-0">
      {nodes.map((node, i) => {
        const c       = STAGE_COLORS[node.state];
        const isLast  = i === nodes.length - 1;

        return (
          <div key={node.stage} className="flex items-stretch gap-3">
            {/* Spine */}
            <div className="flex flex-col items-center">
              {/* Dot */}
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${c.bg} ${c.text} mt-0.5`}>
                {node.state === "active"
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : STAGE_ICONS[node.stage]}
              </div>
              {/* Connector line */}
              {!isLast && (
                <div className={`w-0.5 flex-1 my-1 ${c.line} min-h-[12px]`} />
              )}
            </div>

            {/* Content */}
            <div className={`pb-${isLast ? "0" : "3"} pt-0.5 flex-1 min-w-0`}>
              <div className="flex items-baseline gap-2 flex-wrap">
                <p className={`text-[11px] font-bold ${c.text}`}>{node.label}</p>
                {node.timestamp && (
                  <span className="text-[10px] text-muted-foreground/40">{fmtTime(node.timestamp)}</span>
                )}
              </div>
              {node.detail && (
                <p className="text-[10px] text-muted-foreground/50 mt-0.5 leading-relaxed">{node.detail}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Inline metrics row ─────────────────────────────────────────────────────── */

interface MetricsRowProps {
  postAnalytics?: PostAnalytics;
}

export function MetricsRow({ postAnalytics }: MetricsRowProps) {
  if (!postAnalytics) return null;

  const m = postAnalytics.metrics;
  const metrics = [
    { label: "Views",  value: (m.views ?? 0).toLocaleString() },
    { label: "Likes",  value: (m.likes ?? 0).toLocaleString() },
    { label: "Shares", value: (m.shares ?? 0).toLocaleString() },
    { label: "CTR",    value: m.ctr ? `${m.ctr}%` : null },
    { label: "Retention", value: m.retention ? `${m.retention}%` : null },
  ].filter(x => x.value && x.value !== "0");

  if (metrics.length === 0) return null;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {metrics.map(({ label, value }) => (
        <div key={label} className="text-center">
          <p className="text-[12px] font-bold text-foreground">{value}</p>
          <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wide">{label}</p>
        </div>
      ))}
    </div>
  );
}
