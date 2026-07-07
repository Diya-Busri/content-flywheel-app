"use client";

/**
 * AnalyticsDepartment.tsx — Phase 5.2
 * ──────────────────────────────────────────────────────────────────────────────
 * AI Analyst + Continuous Learning Loop.
 *
 * Tabs: Intelligence Report | Posts | Recommendations | Learning | Trends
 */

import { useCallback, useEffect, useState } from "react";
import type {
  AnalyticsDepartment as AnalyticsDeptType,
  PostAnalytics,
  AnalyticsInsight,
  AnalyticsRecommendation,
  DailyIntelligenceReport,
  RecommendationStatus,
  MarketingManagerId,
  LearningLesson,
  PerformanceTrend,
} from "@/db/schema/launch-schema";

/* ─── Static maps ────────────────────────────────────────────────────────────── */

const MANAGER_EMOJI: Record<MarketingManagerId, string> = {
  tiktok: "🎵", instagram: "📸", youtube: "▶️", x: "✖", linkedin: "💼", email: "📧", seo: "🔍",
};

const LESSON_EMOJI: Record<string, string> = {
  hooks: "🪝", cta: "👆", timing: "⏰", format: "📐",
  style: "🎨", topic: "💡", platform: "📱", avoid: "⚠️",
};

const LESSON_COLOR: Record<string, string> = {
  hooks:    "border-blue-500/20 bg-blue-500/[0.04]",
  cta:      "border-green-500/20 bg-green-500/[0.04]",
  timing:   "border-amber-500/20 bg-amber-500/[0.04]",
  format:   "border-purple-500/20 bg-purple-500/[0.04]",
  style:    "border-pink-500/20 bg-pink-500/[0.04]",
  topic:    "border-sky-500/20 bg-sky-500/[0.04]",
  platform: "border-indigo-500/20 bg-indigo-500/[0.04]",
  avoid:    "border-red-500/20 bg-red-500/[0.04]",
};

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function insightColor(type: AnalyticsInsight["type"]) {
  const map: Record<string, string> = {
    win:            "bg-green-500/10 text-green-400 border-green-500/20",
    problem:        "bg-red-500/10 text-red-400 border-red-500/20",
    trend:          "bg-blue-500/10 text-blue-400 border-blue-500/20",
    anomaly:        "bg-amber-500/10 text-amber-400 border-amber-500/20",
    recommendation: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  };
  return map[type] ?? "bg-muted/20 text-muted-foreground border-border/40";
}

function insightIcon(type: AnalyticsInsight["type"]) {
  return { win: "🏆", problem: "⚠️", trend: "📈", anomaly: "🔬", recommendation: "💡" }[type] ?? "•";
}

function confidenceDots(confidence: "high" | "medium" | "low", evidenceCount?: number) {
  const filled = confidence === "high" ? 3 : confidence === "medium" ? 2 : 1;
  return (
    <span className="flex items-center gap-0.5" title={`Confidence: ${confidence} — ${evidenceCount ?? 1} evidence point(s)`}>
      {[0, 1, 2].map(i => (
        <span key={i} className={`w-1.5 h-1.5 rounded-full ${i < filled ? (confidence === "high" ? "bg-green-400" : confidence === "medium" ? "bg-amber-400" : "bg-muted-foreground/30") : "bg-muted-foreground/15"}`} />
      ))}
    </span>
  );
}

/* ─── KPI card ───────────────────────────────────────────────────────────────── */

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/30 p-4 flex flex-col gap-1">
      <p className="text-[11px] text-muted-foreground/50 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-[22px] font-bold text-foreground">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground/40">{sub}</p>}
    </div>
  );
}

/* ─── Recommendation row ─────────────────────────────────────────────────────── */

function RecommendationRow({ rec, launchId, onUpdated }: {
  rec: AnalyticsRecommendation; launchId: string; onUpdated: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function setStatus(status: RecommendationStatus) {
    setLoading(true);
    try {
      await fetch(`/api/projects/${launchId}/analytics/recommendations/${rec.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      onUpdated();
    } finally { setLoading(false); }
  }

  const impactColor = { high: "text-red-400", medium: "text-amber-400", low: "text-green-400" }[rec.impact];

  return (
    <div className={`rounded-xl border p-3.5 transition-colors ${
      rec.status === "ignored"    ? "border-border/30 bg-card/10 opacity-50"
      : rec.status === "accepted"   ? "border-green-500/20 bg-green-500/[0.03]"
      : rec.status === "auto_apply" ? "border-blue-500/20 bg-blue-500/[0.03]"
      : "border-border/50 bg-card/30"
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide ${impactColor} border-current/20`}>{rec.impact}</span>
            <span className="text-[9px] text-muted-foreground/40 uppercase">{rec.category}</span>
            {rec.managerId && <span className="text-[10px]">{MANAGER_EMOJI[rec.managerId]}</span>}
          </div>
          <p className="text-[13px] font-medium text-foreground leading-snug">{rec.text}</p>
          <p className="text-[11px] text-muted-foreground/60 mt-1 leading-relaxed">{rec.reasoning}</p>
        </div>
        {rec.status === "pending" ? (
          <div className="shrink-0 flex flex-col gap-1.5 min-w-[118px]">
            <button onClick={() => setStatus("accepted")} disabled={loading}
              className="text-[10px] px-2.5 py-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 font-semibold disabled:opacity-50 transition-colors">
              Accept
            </button>
            <button onClick={() => setStatus("auto_apply")} disabled={loading}
              className="text-[10px] px-2.5 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 font-semibold disabled:opacity-50 transition-colors">
              Apply Automatically
            </button>
            <button onClick={() => setStatus("ignored")} disabled={loading}
              className="text-[10px] px-2.5 py-1.5 rounded-lg bg-muted/20 text-muted-foreground/50 hover:bg-muted/40 disabled:opacity-50 transition-colors">
              Ignore
            </button>
          </div>
        ) : (
          <span className={`shrink-0 text-[10px] font-semibold mt-0.5 ${
            rec.status === "accepted" ? "text-green-400" : rec.status === "auto_apply" ? "text-blue-400" : "text-muted-foreground/30"
          }`}>
            {rec.status === "accepted" ? "Accepted ✓" : rec.status === "auto_apply" ? "Auto-apply ✓" : "Ignored"}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Post card ──────────────────────────────────────────────────────────────── */

function PostCard({ post, launchId, onAnalyse }: {
  post: PostAnalytics; launchId: string; onAnalyse: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const m = post.metrics;

  return (
    <div className={`rounded-xl border transition-colors ${post.insights.length > 0 ? "border-border/60 bg-card/30" : "border-border/40 bg-card/20"}`}>
      <div className="flex items-start gap-3 p-3.5 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className="w-8 h-8 rounded-lg bg-muted/40 flex items-center justify-center text-base shrink-0">
          {MANAGER_EMOJI[post.managerId]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[11px] font-bold text-foreground capitalize">{post.platform}</span>
            <span className="text-[10px] text-muted-foreground/40">
              {new Date(post.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
            {post.insights.filter(i => i.type === "win").length > 0 && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-green-500/10 text-green-400 font-bold">{post.insights.filter(i => i.type === "win").length} win</span>
            )}
            {post.insights.filter(i => i.type === "problem").length > 0 && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/10 text-red-400 font-bold">{post.insights.filter(i => i.type === "problem").length} issue</span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground/60 truncate">{post.metadata.hook ?? post.content.slice(0, 100)}</p>
        </div>
        <div className="shrink-0 flex items-center gap-3 text-[11px] text-muted-foreground/50">
          {m.views    && <span>👁 {fmt(m.views)}</span>}
          {m.reach    && <span>📡 {fmt(m.reach)}</span>}
          {m.retention !== undefined && <span>⏱ {m.retention}%</span>}
          {m.likes    && <span>♥ {fmt(m.likes)}</span>}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/30 px-3.5 pb-3.5 pt-3">
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-3">
            {([
              ["Views", m.views], ["Reach", m.reach], ["Impressions", m.impressions],
              ["Likes", m.likes], ["Comments", m.comments], ["Shares", m.shares],
              ["Saves", m.saves], ["CTR", m.ctr !== undefined ? `${m.ctr}%` : undefined],
              ["Retention", m.retention !== undefined ? `${m.retention}%` : undefined],
              ["Watch time", m.watchTime !== undefined ? `${m.watchTime}s` : undefined],
              ["Followers ↑", m.followersGained], ["Link clicks", m.linkClicks],
            ] as [string, number | string | undefined][]).filter(([, v]) => v !== undefined && v !== 0).map(([label, val]) => (
              <div key={label} className="rounded-lg bg-muted/20 p-2 text-center">
                <p className="text-[10px] text-muted-foreground/40 mb-0.5">{label}</p>
                <p className="text-[13px] font-bold text-foreground">{typeof val === "number" ? fmt(val) : val}</p>
              </div>
            ))}
          </div>
          {(post.metadata.hook || post.metadata.cta) && (
            <div className="flex gap-2 mb-3">
              {post.metadata.hook && (
                <div className="flex-1 rounded-lg border border-border/40 bg-muted/10 p-2">
                  <p className="text-[9px] font-bold text-muted-foreground/40 uppercase mb-0.5">Hook</p>
                  <p className="text-[11px] text-foreground/80 line-clamp-2">{post.metadata.hook}</p>
                </div>
              )}
              {post.metadata.cta && (
                <div className="flex-1 rounded-lg border border-border/40 bg-muted/10 p-2">
                  <p className="text-[9px] font-bold text-muted-foreground/40 uppercase mb-0.5">CTA</p>
                  <p className="text-[11px] text-foreground/80 line-clamp-2">{post.metadata.cta}</p>
                </div>
              )}
            </div>
          )}
          {post.insights.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-wide mb-2">AI Analysis</p>
              {post.insights.map(insight => (
                <div key={insight.id} className={`flex items-start gap-2 p-2.5 rounded-lg border ${insightColor(insight.type)}`}>
                  <span className="shrink-0 text-[12px] mt-0.5">{insightIcon(insight.type)}</span>
                  <div>
                    <p className="text-[12px] leading-relaxed">{insight.text}</p>
                    {insight.evidence && <p className="text-[10px] opacity-60 mt-0.5">{insight.evidence}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/30 bg-muted/10">
              <p className="text-[12px] text-muted-foreground/50 italic">Not yet analysed</p>
              <button onClick={() => onAnalyse(post.id)}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-primary/10 text-primary/80 hover:bg-primary/20 font-medium transition-colors">
                Analyse Now
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Intelligence report card ───────────────────────────────────────────────── */

function IntelligenceReportCard({ report, launchId, onUpdated }: {
  report: DailyIntelligenceReport; launchId: string; onUpdated: () => void;
}) {
  const s = report.summary;
  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/[0.02] overflow-hidden">
      <div className="px-5 pt-5 pb-4 border-b border-border/30">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary/70 uppercase tracking-wide">Intelligence Report</span>
            <span className="text-[11px] text-muted-foreground/40">{new Date(report.date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</span>
          </div>
          {report.recommendations.filter(r => r.status === "pending").length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-semibold">
              {report.recommendations.filter(r => r.status === "pending").length} pending
            </span>
          )}
        </div>
        {report.narrative && <p className="text-[13px] text-foreground/80 leading-relaxed mt-2">{report.narrative}</p>}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-px bg-border/20">
        {[
          ["Published", s.postsPublished.toString()], ["Reach", fmt(s.totalReach)], ["Views", fmt(s.totalViews)],
          ["Followers ↑", `+${s.followersGained}`], ["Sales", s.sales.toString()], ["Revenue", `£${s.revenue.toFixed(0)}`],
        ].map(([label, val]) => (
          <div key={label} className="bg-background/40 px-3 py-3 text-center">
            <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wide mb-0.5">{label}</p>
            <p className="text-[15px] font-bold text-foreground">{val}</p>
          </div>
        ))}
      </div>

      <div className="p-5 space-y-4">
        {(report.biggestWin || report.biggestProblem) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {report.biggestWin && (
              <div className="rounded-xl border border-green-500/20 bg-green-500/[0.04] p-3.5">
                <p className="text-[10px] font-bold text-green-400/70 uppercase tracking-wide mb-1">🏆 Biggest Win</p>
                <p className="text-[12px] font-semibold capitalize">{report.biggestWin.platform}</p>
                <p className="text-[11px] text-foreground/70 mt-0.5 leading-relaxed">{report.biggestWin.reason}</p>
                <p className="text-[10px] text-green-400/60 mt-1">{report.biggestWin.metric}: {fmt(report.biggestWin.value)}</p>
              </div>
            )}
            {report.biggestProblem && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-3.5">
                <p className="text-[10px] font-bold text-red-400/70 uppercase tracking-wide mb-1">⚠️ Biggest Problem</p>
                <p className="text-[12px] font-semibold capitalize">{report.biggestProblem.platform ?? "All platforms"}</p>
                <p className="text-[11px] text-foreground/70 mt-0.5 leading-relaxed">{report.biggestProblem.description}</p>
              </div>
            )}
          </div>
        )}

        {report.insights.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-wide mb-2">Insights</p>
            <div className="space-y-2">
              {report.insights.map(i => (
                <div key={i.id} className={`flex items-start gap-2 p-2.5 rounded-lg border ${insightColor(i.type)}`}>
                  <span className="shrink-0">{insightIcon(i.type)}</span>
                  <p className="text-[12px] leading-relaxed">{i.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {report.recommendations.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-wide mb-2">Recommendations</p>
            <div className="space-y-2">
              {report.recommendations.map(r => (
                <RecommendationRow key={r.id} rec={r} launchId={launchId} onUpdated={onUpdated} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Learning tab ───────────────────────────────────────────────────────────── */

function LearningTab({ lessons, todaysSummary, learningCycles, launchId, onLearn, learning }: {
  lessons: LearningLesson[];
  todaysSummary?: string;
  learningCycles?: number;
  launchId: string;
  onLearn: () => void;
  learning: boolean;
}) {
  if (lessons.length === 0 && !todaysSummary) {
    return (
      <div className="rounded-2xl border border-dashed border-border/40 p-8 text-center">
        <p className="text-[28px] mb-2">🧠</p>
        <p className="text-[13px] font-semibold text-foreground mb-1">No lessons learned yet</p>
        <p className="text-[12px] text-muted-foreground/50 mb-4">Analyse posts first, then learning runs automatically.</p>
        <button onClick={onLearn} disabled={learning}
          className="text-[12px] px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {learning ? "Learning…" : "Run Learning Now"}
        </button>
      </div>
    );
  }

  const byCategory = new Map<string, LearningLesson[]>();
  for (const lesson of lessons) {
    if (!byCategory.has(lesson.category)) byCategory.set(lesson.category, []);
    byCategory.get(lesson.category)!.push(lesson);
  }

  return (
    <div className="space-y-4">
      {/* "What the company learned today" card */}
      {todaysSummary && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold text-emerald-400/70 uppercase tracking-wide">🧠 What the company learned</p>
            {learningCycles !== undefined && (
              <span className="text-[10px] text-muted-foreground/40">Cycle #{learningCycles}</span>
            )}
          </div>
          <p className="text-[13px] text-foreground/85 leading-relaxed">{todaysSummary}</p>
        </div>
      )}

      {/* Lessons by category */}
      {[...byCategory.entries()].map(([cat, catLessons]) => (
        <div key={cat}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[14px]">{LESSON_EMOJI[cat] ?? "📌"}</span>
            <p className="text-[11px] font-bold text-foreground/70 uppercase tracking-wide capitalize">{cat}</p>
            <span className="text-[10px] text-muted-foreground/30">{catLessons.length} lesson{catLessons.length > 1 ? "s" : ""}</span>
          </div>
          <div className="space-y-2">
            {catLessons.map(lesson => (
              <div key={lesson.id} className={`rounded-xl border p-3.5 ${LESSON_COLOR[lesson.category] ?? "border-border/50 bg-card/30"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-[12px] font-semibold text-foreground leading-snug">{lesson.lesson}</p>
                    <p className="text-[11px] text-muted-foreground/60 mt-1 leading-relaxed">{lesson.evidence}</p>
                    {lesson.platforms.length > 0 && (
                      <div className="flex items-center gap-1 mt-2">
                        {lesson.platforms.map(p => (
                          <span key={p} className="text-[11px]">{MANAGER_EMOJI[p]}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    {confidenceDots(lesson.confidence, lesson.evidenceCount)}
                    <span className="text-[9px] text-muted-foreground/30">{lesson.evidenceCount}× evidence</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex justify-end">
        <button onClick={onLearn} disabled={learning}
          className="text-[11px] px-3 py-1.5 rounded-lg border border-border/60 bg-card hover:bg-muted/30 disabled:opacity-40 transition-colors font-medium">
          {learning ? "Learning…" : "Re-run Learning"}
        </button>
      </div>
    </div>
  );
}

/* ─── Trends tab ─────────────────────────────────────────────────────────────── */

function TrendsTab({ trends }: { trends: PerformanceTrend[] }) {
  if (trends.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/40 p-8 text-center">
        <p className="text-[28px] mb-2">📈</p>
        <p className="text-[13px] font-semibold text-foreground mb-1">No trends yet</p>
        <p className="text-[12px] text-muted-foreground/50">Trends appear once you have multiple posts analysed across different time periods.</p>
      </div>
    );
  }

  const platforms = [...new Set(trends.map(t => t.platform))] as MarketingManagerId[];

  return (
    <div className="space-y-5">
      {platforms.map(platform => {
        const platTrends = trends.filter(t => t.platform === platform);
        const ups   = platTrends.filter(t => t.direction === "up").length;
        const downs = platTrends.filter(t => t.direction === "down").length;

        return (
          <div key={platform} className="rounded-xl border border-border/50 bg-card/20 overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/30">
              <span className="text-[16px]">{MANAGER_EMOJI[platform]}</span>
              <p className="text-[13px] font-bold capitalize">{platform}</p>
              <div className="flex items-center gap-1.5 ml-auto">
                {ups > 0    && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 font-semibold">{ups} ↑</span>}
                {downs > 0  && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-semibold">{downs} ↓</span>}
              </div>
            </div>

            <div className="divide-y divide-border/20">
              {platTrends.map(trend => (
                <div key={`${trend.platform}-${trend.metric}`} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[16px] ${trend.direction === "up" ? "text-green-400" : trend.direction === "down" ? "text-red-400" : "text-muted-foreground/40"}`}>
                        {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"}
                      </span>
                      <p className="text-[12px] font-medium text-foreground capitalize">{trend.metric.replace(/_/g, " ")}</p>
                      <span className={`text-[11px] font-bold ${trend.changePercent > 0 ? "text-green-400" : trend.changePercent < 0 ? "text-red-400" : "text-muted-foreground/50"}`}>
                        {trend.changePercent > 0 ? "+" : ""}{trend.changePercent}%
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground/50 mt-0.5">{trend.summary}</p>
                  </div>

                  {/* Mini sparkline */}
                  {trend.dataPoints.length >= 2 && (
                    <div className="shrink-0 flex items-end gap-0.5 h-8">
                      {(() => {
                        const vals   = trend.dataPoints.map(d => d.value);
                        const maxVal = Math.max(...vals);
                        const minVal = Math.min(...vals);
                        const range  = maxVal - minVal || 1;
                        return vals.map((v, i) => {
                          const h = Math.max(2, Math.round(((v - minVal) / range) * 28));
                          const isLast = i === vals.length - 1;
                          return (
                            <div key={i} className={`w-1.5 rounded-sm ${isLast ? (trend.direction === "up" ? "bg-green-400/70" : trend.direction === "down" ? "bg-red-400/70" : "bg-muted-foreground/30") : "bg-muted-foreground/20"}`}
                              style={{ height: `${h}px` }} />
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────────── */

export function AnalyticsDepartment({ launchId }: { launchId: string }) {
  const [dept, setDept]               = useState<AnalyticsDeptType | null>(null);
  const [loading, setLoading]         = useState(true);
  const [syncing, setSyncing]         = useState(false);
  const [analysing, setAnalysing]     = useState(false);
  const [reporting, setReporting]     = useState(false);
  const [learning, setLearning]       = useState(false);
  const [activeTab, setActiveTab]     = useState<"report" | "posts" | "recommendations" | "learning" | "trends">("report");

  const fetchDept = useCallback(async () => {
    try {
      const res  = await fetch(`/api/projects/${launchId}/analytics`);
      const data = await res.json() as { analyticsDept: AnalyticsDeptType | null };
      setDept(data.analyticsDept);
    } catch { /* ignore */ }
  }, [launchId]);

  useEffect(() => { fetchDept().finally(() => setLoading(false)); }, [fetchDept]);

  async function handleSync() {
    setSyncing(true);
    try {
      const data = await fetch(`/api/projects/${launchId}/analytics`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      }).then(r => r.json()) as { analyticsDept: AnalyticsDeptType };
      setDept(data.analyticsDept);
    } finally { setSyncing(false); }
  }

  async function handleAnalyse(postId?: string) {
    setAnalysing(true);
    try {
      const data = await fetch(`/api/projects/${launchId}/analytics/analyze`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postId ? { postId } : {}),
      }).then(r => r.json()) as { analyticsDept: AnalyticsDeptType };
      setDept(data.analyticsDept);
    } finally { setAnalysing(false); }
  }

  async function handleReport() {
    setReporting(true);
    try {
      const data = await fetch(`/api/projects/${launchId}/analytics/report`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      }).then(r => r.json()) as { analyticsDept: AnalyticsDeptType };
      setDept(data.analyticsDept);
      setActiveTab("report");
    } finally { setReporting(false); }
  }

  async function handleLearn() {
    setLearning(true);
    try {
      const data = await fetch(`/api/projects/${launchId}/analytics/learn`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      }).then(r => r.json()) as { analyticsDept: AnalyticsDeptType };
      setDept(data.analyticsDept);
      setActiveTab("learning");
    } finally { setLearning(false); }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-16 rounded-xl bg-muted/40" />
        <div className="h-64 rounded-2xl bg-muted/30" />
        {[...Array(3)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-muted/20" />)}
      </div>
    );
  }

  const posts           = dept?.posts ?? [];
  const recommendations = dept?.recommendations ?? [];
  const lessons         = dept?.lessons ?? [];
  const trends          = dept?.trends ?? [];
  const latestReport    = dept?.reports?.[0] ?? null;
  const totalReach      = posts.reduce((n, p) => n + (p.metrics.reach ?? 0), 0);
  const totalViews      = posts.reduce((n, p) => n + (p.metrics.views ?? 0), 0);
  const followersGained = posts.reduce((n, p) => n + (p.metrics.followersGained ?? 0), 0);
  const unanalysedCount = posts.filter(p => !p.analysedAt).length;
  const pendingCount    = recommendations.filter(r => r.status === "pending").length;

  const TABS = [
    { id: "report",          label: "Report" },
    { id: "posts",           label: `Posts (${posts.length})` },
    { id: "recommendations", label: `Recs (${recommendations.length})` },
    { id: "learning",        label: `Learning (${lessons.length})` },
    { id: "trends",          label: `Trends (${trends.length})` },
  ] as const;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-bold text-foreground tracking-tight">Analytics Intelligence</h2>
          <p className="text-[12px] text-muted-foreground/50 mt-0.5">
            {posts.length > 0
              ? `${posts.length} posts · ${fmt(totalReach)} reach · ${lessons.length} lessons learned`
              : "Sync published content to start learning"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <button onClick={handleSync} disabled={syncing}
            className="text-[11px] px-3 py-1.5 rounded-lg border border-border/60 bg-card hover:bg-muted/30 disabled:opacity-40 transition-colors font-medium">
            {syncing ? "Syncing…" : "Sync"}
          </button>
          {unanalysedCount > 0 && (
            <button onClick={() => handleAnalyse()} disabled={analysing}
              className="text-[11px] px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary/80 hover:bg-primary/20 disabled:opacity-40 transition-colors font-medium">
              {analysing ? "Analysing…" : `Analyse (${unanalysedCount})`}
            </button>
          )}
          <button onClick={handleReport} disabled={reporting || posts.length === 0}
            className="text-[11px] px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted/30 disabled:opacity-40 transition-colors font-semibold">
            {reporting ? "Generating…" : "Daily Report"}
          </button>
          <button onClick={handleLearn} disabled={learning || posts.filter(p => p.analysedAt).length < 2}
            className="text-[11px] px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40 transition-colors font-semibold">
            {learning ? "Learning…" : "Learn"}
          </button>
        </div>
      </div>

      {/* Empty state */}
      {posts.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border/40 p-10 text-center">
          <p className="text-[32px] mb-3">📊</p>
          <p className="text-[14px] font-semibold mb-1">No analytics data yet</p>
          <p className="text-[12px] text-muted-foreground/50 mb-4 max-w-sm mx-auto">
            Publish content through the Marketing Department, then Sync to pull metrics.
          </p>
          <button onClick={handleSync} disabled={syncing}
            className="text-[12px] px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {syncing ? "Syncing…" : "Sync Published Content"}
          </button>
        </div>
      )}

      {/* KPIs */}
      {posts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Total Reach"      value={fmt(totalReach)}            sub="across all platforms" />
          <KpiCard label="Total Views"      value={fmt(totalViews)}            sub="all posts" />
          <KpiCard label="Followers Gained" value={`+${followersGained}`}      sub="from analytics period" />
          <KpiCard label="Lessons Learned"  value={lessons.length.toString()}  sub={`${pendingCount} recs pending`} />
        </div>
      )}

      {/* "What the company learned" banner (if learning has run) */}
      {dept?.todaysSummary && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] px-4 py-3 flex items-start gap-3">
          <span className="text-[16px] shrink-0">🧠</span>
          <p className="text-[12px] text-foreground/80 leading-relaxed">{dept.todaysSummary}</p>
        </div>
      )}

      {/* Tabs */}
      {posts.length > 0 && (
        <>
          <div className="flex gap-0.5 border-b border-border/30 overflow-x-auto">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`text-[12px] px-3 py-2 font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                  activeTab === tab.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "report" && (
            latestReport ? (
              <IntelligenceReportCard report={latestReport} launchId={launchId} onUpdated={fetchDept} />
            ) : (
              <div className="rounded-2xl border border-dashed border-border/40 p-8 text-center">
                <p className="text-[13px] font-semibold mb-1">No report yet</p>
                <p className="text-[12px] text-muted-foreground/50 mb-4">Analyse posts, then generate your first daily report.</p>
                <div className="flex items-center justify-center gap-2">
                  {unanalysedCount > 0 && (
                    <button onClick={() => handleAnalyse()} disabled={analysing}
                      className="text-[12px] px-3.5 py-2 rounded-xl border border-primary/30 bg-primary/10 text-primary/80 font-semibold disabled:opacity-50">
                      {analysing ? "Analysing…" : `1. Analyse (${unanalysedCount})`}
                    </button>
                  )}
                  <button onClick={handleReport} disabled={reporting}
                    className="text-[12px] px-3.5 py-2 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50">
                    {reporting ? "Generating…" : "2. Generate Report"}
                  </button>
                </div>
              </div>
            )
          )}

          {activeTab === "posts" && (
            <div className="space-y-2">
              {[...posts].reverse().map(post => (
                <PostCard key={post.id} post={post} launchId={launchId} onAnalyse={id => handleAnalyse(id)} />
              ))}
            </div>
          )}

          {activeTab === "recommendations" && (
            <div className="space-y-2">
              {recommendations.length === 0 ? (
                <p className="text-[12px] text-muted-foreground/40 italic p-4 text-center">Generate a daily report to get recommendations</p>
              ) : (
                [...recommendations]
                  .sort((a, b) => {
                    const s = { pending: 0, accepted: 1, auto_apply: 2, ignored: 3 };
                    const i = { high: 0, medium: 1, low: 2 };
                    return (s[a.status] - s[b.status]) || (i[a.impact] - i[b.impact]);
                  })
                  .map(rec => <RecommendationRow key={rec.id} rec={rec} launchId={launchId} onUpdated={fetchDept} />)
              )}
            </div>
          )}

          {activeTab === "learning" && (
            <LearningTab
              lessons={lessons}
              todaysSummary={dept?.todaysSummary}
              learningCycles={dept?.learningCycles}
              launchId={launchId}
              onLearn={handleLearn}
              learning={learning}
            />
          )}

          {activeTab === "trends" && <TrendsTab trends={trends} />}
        </>
      )}

      <p className="text-[11px] text-muted-foreground/30 text-center pt-1">
        Every insight feeds Business Memory · Every campaign makes the next one smarter
      </p>
    </div>
  );
}

/* ─── Exported learning card for Mission Control ─────────────────────────────── */

export function LearningCard({ launchId }: { launchId: string }) {
  const [summary, setSummary]   = useState<string | null>(null);
  const [lessons, setLessons]   = useState<LearningLesson[]>([]);
  const [cycles, setCycles]     = useState(0);

  useEffect(() => {
    fetch(`/api/projects/${launchId}/analytics`)
      .then(r => r.json())
      .then((data: { analyticsDept: AnalyticsDeptType | null }) => {
        if (!data.analyticsDept) return;
        setSummary(data.analyticsDept.todaysSummary ?? null);
        setLessons((data.analyticsDept.lessons ?? []).slice(0, 3));
        setCycles(data.analyticsDept.learningCycles ?? 0);
      })
      .catch(() => {});
  }, [launchId]);

  if (!summary && lessons.length === 0) return null;

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-bold text-emerald-400/70 uppercase tracking-wide">🧠 What the company learned</p>
        {cycles > 0 && <span className="text-[10px] text-muted-foreground/30">Cycle #{cycles}</span>}
      </div>
      {summary && <p className="text-[12px] text-foreground/80 leading-relaxed mb-3">{summary}</p>}
      {lessons.length > 0 && (
        <div className="space-y-1.5">
          {lessons.map(l => (
            <div key={l.id} className="flex items-start gap-1.5">
              <span className="shrink-0 text-[11px] mt-0.5">{LESSON_EMOJI[l.category] ?? "📌"}</span>
              <p className="text-[11px] text-foreground/70 leading-snug">{l.lesson}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
