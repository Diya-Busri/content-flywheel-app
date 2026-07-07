"use client";

/**
 * AnalyticsDepartment.tsx — Phase 5.1
 * ──────────────────────────────────────────────────────────────────────────────
 * AI Analyst — not a dashboard.
 *
 * Sections:
 *   1. Summary KPIs
 *   2. Daily Intelligence Report (narrative + win/problem + recommendations)
 *   3. Post Performance (with AI insights per post)
 *   4. All Recommendations panel
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
} from "@/db/schema/launch-schema";

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

const MANAGER_EMOJI: Record<MarketingManagerId, string> = {
  tiktok: "🎵", instagram: "📸", youtube: "▶️", x: "✖", linkedin: "💼", email: "📧", seo: "🔍",
};

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

function impactColor(impact: AnalyticsRecommendation["impact"]) {
  return { high: "text-red-400", medium: "text-amber-400", low: "text-green-400" }[impact];
}

function statusLabel(status: RecommendationStatus) {
  return { pending: "Pending", accepted: "Accepted ✓", ignored: "Ignored", auto_apply: "Auto-apply ✓" }[status];
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

function RecommendationRow({
  rec, launchId, onUpdated,
}: {
  rec:       AnalyticsRecommendation;
  launchId:  string;
  onUpdated: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function setStatus(status: RecommendationStatus) {
    setLoading(true);
    try {
      await fetch(`/api/projects/${launchId}/analytics/recommendations/${rec.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status }),
      });
      onUpdated();
    } finally { setLoading(false); }
  }

  return (
    <div className={`rounded-xl border p-3.5 transition-colors ${
      rec.status === "ignored"    ? "border-border/30 bg-card/10 opacity-50"
      : rec.status === "accepted" ? "border-green-500/20 bg-green-500/[0.03]"
      : rec.status === "auto_apply" ? "border-blue-500/20 bg-blue-500/[0.03]"
      : "border-border/50 bg-card/30"
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide ${impactColor(rec.impact)} border-current/20`}>
              {rec.impact}
            </span>
            <span className="text-[9px] text-muted-foreground/40 uppercase tracking-wide">
              {rec.category}
            </span>
            {rec.managerId && (
              <span className="text-[10px]">{MANAGER_EMOJI[rec.managerId]}</span>
            )}
          </div>
          <p className="text-[13px] font-medium text-foreground leading-snug">{rec.text}</p>
          <p className="text-[11px] text-muted-foreground/60 mt-1 leading-relaxed">{rec.reasoning}</p>
        </div>

        {rec.status === "pending" ? (
          <div className="shrink-0 flex flex-col gap-1.5 min-w-[110px]">
            <button
              onClick={() => setStatus("accepted")}
              disabled={loading}
              className="text-[10px] px-2.5 py-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 font-semibold disabled:opacity-50 transition-colors"
            >
              Accept
            </button>
            <button
              onClick={() => setStatus("auto_apply")}
              disabled={loading}
              className="text-[10px] px-2.5 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 font-semibold disabled:opacity-50 transition-colors"
            >
              Apply Automatically
            </button>
            <button
              onClick={() => setStatus("ignored")}
              disabled={loading}
              className="text-[10px] px-2.5 py-1.5 rounded-lg bg-muted/20 text-muted-foreground/50 hover:bg-muted/40 disabled:opacity-50 transition-colors"
            >
              Ignore
            </button>
          </div>
        ) : (
          <span className={`shrink-0 text-[10px] font-semibold mt-0.5 ${
            rec.status === "accepted"   ? "text-green-400"
            : rec.status === "auto_apply" ? "text-blue-400"
            : "text-muted-foreground/30"
          }`}>
            {statusLabel(rec.status)}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Post card ──────────────────────────────────────────────────────────────── */

function PostCard({
  post, launchId, onAnalyse,
}: {
  post:      PostAnalytics;
  launchId:  string;
  onAnalyse: (postId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const m = post.metrics;

  const hasInsights = post.insights.length > 0;
  const winCount    = post.insights.filter(i => i.type === "win").length;
  const problemCount = post.insights.filter(i => i.type === "problem").length;

  return (
    <div className={`rounded-xl border transition-colors ${
      hasInsights ? "border-border/60 bg-card/30" : "border-border/40 bg-card/20"
    }`}>
      {/* Header */}
      <div
        className="flex items-start gap-3 p-3.5 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="w-8 h-8 rounded-lg bg-muted/40 flex items-center justify-center text-base shrink-0">
          {MANAGER_EMOJI[post.managerId]}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[11px] font-bold text-foreground capitalize">{post.platform}</span>
            <span className="text-[10px] text-muted-foreground/40">
              {new Date(post.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
            {winCount > 0 && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-green-500/10 text-green-400 font-bold">{winCount} win</span>
            )}
            {problemCount > 0 && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/10 text-red-400 font-bold">{problemCount} issue</span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground/60 truncate">
            {post.metadata.hook ?? post.content.slice(0, 100)}
          </p>
        </div>

        {/* Quick metrics */}
        <div className="shrink-0 flex items-center gap-3 text-[11px] text-muted-foreground/50">
          {m.views    && <span>👁 {fmt(m.views)}</span>}
          {m.reach    && <span>📡 {fmt(m.reach)}</span>}
          {m.retention && <span>⏱ {m.retention}%</span>}
          {m.likes    && <span>♥ {fmt(m.likes)}</span>}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border/30 px-3.5 pb-3.5 pt-3">
          {/* Full metrics grid */}
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-3">
            {[
              { label: "Views",        val: m.views },
              { label: "Reach",        val: m.reach },
              { label: "Impressions",  val: m.impressions },
              { label: "Likes",        val: m.likes },
              { label: "Comments",     val: m.comments },
              { label: "Shares",       val: m.shares },
              { label: "Saves",        val: m.saves },
              { label: "CTR",          val: m.ctr !== undefined ? `${m.ctr}%` : undefined },
              { label: "Retention",    val: m.retention !== undefined ? `${m.retention}%` : undefined },
              { label: "Watch time",   val: m.watchTime !== undefined ? `${m.watchTime}s` : undefined },
              { label: "Followers ↑",  val: m.followersGained },
              { label: "Link clicks",  val: m.linkClicks },
            ].filter(x => x.val !== undefined && x.val !== 0).map(({ label, val }) => (
              <div key={label} className="rounded-lg bg-muted/20 p-2 text-center">
                <p className="text-[10px] text-muted-foreground/40 mb-0.5">{label}</p>
                <p className="text-[13px] font-bold text-foreground">{typeof val === "number" ? fmt(val) : val}</p>
              </div>
            ))}
          </div>

          {/* Hook / CTA metadata */}
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

          {/* AI insights */}
          {hasInsights ? (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-wide mb-2">AI Analysis</p>
              {post.insights.map(insight => (
                <div key={insight.id} className={`flex items-start gap-2 p-2.5 rounded-lg border ${insightColor(insight.type)}`}>
                  <span className="shrink-0 text-[12px] mt-0.5">{insightIcon(insight.type)}</span>
                  <div>
                    <p className="text-[12px] leading-relaxed">{insight.text}</p>
                    {insight.evidence && (
                      <p className="text-[10px] opacity-60 mt-0.5">{insight.evidence}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/30 bg-muted/10">
              <p className="text-[12px] text-muted-foreground/50 italic">Not yet analysed by AI</p>
              <button
                onClick={() => onAnalyse(post.id)}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-primary/10 text-primary/80 hover:bg-primary/20 font-medium transition-colors"
              >
                Analyse Now
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Daily intelligence report ──────────────────────────────────────────────── */

function IntelligenceReportCard({
  report, launchId, onUpdated,
}: {
  report:    DailyIntelligenceReport;
  launchId:  string;
  onUpdated: () => void;
}) {
  const s = report.summary;
  const pendingRecs = report.recommendations.filter(r => r.status === "pending");

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/[0.02] overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-border/30">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary/70 uppercase tracking-wide">Intelligence Report</span>
            <span className="text-[11px] text-muted-foreground/40">{new Date(report.date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</span>
          </div>
          {pendingRecs.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-semibold">{pendingRecs.length} pending</span>
          )}
        </div>
        {report.narrative && (
          <p className="text-[13px] text-foreground/80 leading-relaxed mt-2">{report.narrative}</p>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-px bg-border/20">
        {[
          { label: "Published",      val: s.postsPublished.toString() },
          { label: "Reach",          val: fmt(s.totalReach) },
          { label: "Views",          val: fmt(s.totalViews) },
          { label: "Followers ↑",    val: `+${s.followersGained}` },
          { label: "Sales",          val: s.sales.toString() },
          { label: "Revenue",        val: `£${s.revenue.toFixed(0)}` },
        ].map(({ label, val }) => (
          <div key={label} className="bg-background/40 px-3 py-3 text-center">
            <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wide mb-0.5">{label}</p>
            <p className="text-[15px] font-bold text-foreground">{val}</p>
          </div>
        ))}
      </div>

      <div className="p-5 space-y-4">
        {/* Win / Problem */}
        {(report.biggestWin || report.biggestProblem) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {report.biggestWin && (
              <div className="rounded-xl border border-green-500/20 bg-green-500/[0.04] p-3.5">
                <p className="text-[10px] font-bold text-green-400/70 uppercase tracking-wide mb-1">🏆 Biggest Win</p>
                <p className="text-[12px] font-semibold text-foreground capitalize">{report.biggestWin.platform}</p>
                <p className="text-[11px] text-foreground/70 mt-0.5 leading-relaxed">{report.biggestWin.reason}</p>
                <p className="text-[10px] text-green-400/60 mt-1">{report.biggestWin.metric}: {fmt(report.biggestWin.value)}</p>
              </div>
            )}
            {report.biggestProblem && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-3.5">
                <p className="text-[10px] font-bold text-red-400/70 uppercase tracking-wide mb-1">⚠️ Biggest Problem</p>
                <p className="text-[12px] font-semibold text-foreground capitalize">{report.biggestProblem.platform ?? "All platforms"}</p>
                <p className="text-[11px] text-foreground/70 mt-0.5 leading-relaxed">{report.biggestProblem.description}</p>
              </div>
            )}
          </div>
        )}

        {/* Report insights */}
        {report.insights.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-wide mb-2">Insights</p>
            <div className="space-y-2">
              {report.insights.map(i => (
                <div key={i.id} className={`flex items-start gap-2 p-2.5 rounded-lg border ${insightColor(i.type)}`}>
                  <span className="shrink-0 text-[12px]">{insightIcon(i.type)}</span>
                  <p className="text-[12px] leading-relaxed">{i.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
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

/* ─── Main component ─────────────────────────────────────────────────────────── */

export function AnalyticsDepartment({ launchId }: { launchId: string }) {
  const [dept, setDept]         = useState<AnalyticsDeptType | null>(null);
  const [loading, setLoading]   = useState(true);
  const [syncing, setSyncing]   = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [activeTab, setActiveTab] = useState<"report" | "posts" | "recommendations">("report");

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
      const res  = await fetch(`/api/projects/${launchId}/analytics`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      const data = await res.json() as { analyticsDept: AnalyticsDeptType };
      setDept(data.analyticsDept);
    } finally { setSyncing(false); }
  }

  async function handleAnalyse(postId?: string) {
    setAnalysing(true);
    try {
      const res  = await fetch(`/api/projects/${launchId}/analytics/analyze`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postId ? { postId } : {}),
      });
      const data = await res.json() as { analyticsDept: AnalyticsDeptType };
      setDept(data.analyticsDept);
    } finally { setAnalysing(false); }
  }

  async function handleReport() {
    setReporting(true);
    try {
      const res  = await fetch(`/api/projects/${launchId}/analytics/report`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json() as { analyticsDept: AnalyticsDeptType };
      setDept(data.analyticsDept);
      setActiveTab("report");
    } finally { setReporting(false); }
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

  const posts            = dept?.posts ?? [];
  const recommendations  = dept?.recommendations ?? [];
  const latestReport     = dept?.reports?.[0] ?? null;
  const totalReach       = posts.reduce((n, p) => n + (p.metrics.reach ?? 0), 0);
  const totalViews       = posts.reduce((n, p) => n + (p.metrics.views ?? 0), 0);
  const followersGained  = posts.reduce((n, p) => n + (p.metrics.followersGained ?? 0), 0);
  const unanalysedCount  = posts.filter(p => !p.analysedAt).length;
  const pendingRecsCount = recommendations.filter(r => r.status === "pending").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-bold text-foreground tracking-tight">Analytics Intelligence</h2>
          <p className="text-[12px] text-muted-foreground/50 mt-0.5">
            {posts.length > 0
              ? `${posts.length} post${posts.length > 1 ? "s" : ""} tracked · ${fmt(totalReach)} total reach · ${fmt(followersGained)} followers gained`
              : "Sync your published content to start learning"}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="text-[11px] px-3 py-1.5 rounded-lg border border-border/60 bg-card hover:bg-muted/30 disabled:opacity-40 transition-colors font-medium"
          >
            {syncing ? "Syncing…" : "Sync"}
          </button>
          {unanalysedCount > 0 && (
            <button
              onClick={() => handleAnalyse()}
              disabled={analysing}
              className="text-[11px] px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary/80 hover:bg-primary/20 disabled:opacity-40 transition-colors font-medium"
            >
              {analysing ? "Analysing…" : `Analyse (${unanalysedCount})`}
            </button>
          )}
          <button
            onClick={handleReport}
            disabled={reporting || posts.length === 0}
            className="text-[11px] px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted/30 disabled:opacity-40 transition-colors font-semibold"
          >
            {reporting ? "Generating…" : "Daily Report"}
          </button>
        </div>
      </div>

      {/* Empty state */}
      {posts.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border/40 p-10 text-center">
          <p className="text-[32px] mb-3">📊</p>
          <p className="text-[14px] font-semibold text-foreground mb-1">No analytics data yet</p>
          <p className="text-[12px] text-muted-foreground/50 mb-4 max-w-sm mx-auto">
            Publish content through the Marketing Department, then click Sync to pull metrics and run AI analysis.
          </p>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="text-[12px] px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {syncing ? "Syncing…" : "Sync Published Content"}
          </button>
        </div>
      )}

      {/* KPIs */}
      {posts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Total Reach"       value={fmt(totalReach)}       sub="across all platforms" />
          <KpiCard label="Total Views"       value={fmt(totalViews)}       sub="all posts" />
          <KpiCard label="Followers Gained"  value={`+${followersGained}`} sub="from analytics period" />
          <KpiCard label="Recommendations"   value={pendingRecsCount.toString()} sub="pending review" />
        </div>
      )}

      {/* Tabs */}
      {posts.length > 0 && (
        <>
          <div className="flex gap-1 border-b border-border/30 pb-0">
            {(["report", "posts", "recommendations"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-[12px] px-3.5 py-2 font-medium capitalize transition-colors border-b-2 -mb-px ${
                  activeTab === tab
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "report" ? "Intelligence Report" : tab === "posts" ? `Posts (${posts.length})` : `Recommendations (${recommendations.length})`}
              </button>
            ))}
          </div>

          {/* Intelligence Report tab */}
          {activeTab === "report" && (
            latestReport ? (
              <IntelligenceReportCard
                report={latestReport}
                launchId={launchId}
                onUpdated={fetchDept}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-border/40 p-8 text-center">
                <p className="text-[28px] mb-2">📋</p>
                <p className="text-[13px] font-semibold text-foreground mb-1">No intelligence report yet</p>
                <p className="text-[12px] text-muted-foreground/50 mb-4">Analyse your posts first, then generate your first daily report.</p>
                <div className="flex items-center justify-center gap-2">
                  {unanalysedCount > 0 && (
                    <button
                      onClick={() => handleAnalyse()}
                      disabled={analysing}
                      className="text-[12px] px-3.5 py-2 rounded-xl border border-primary/30 bg-primary/10 text-primary/80 font-semibold disabled:opacity-50"
                    >
                      {analysing ? "Analysing…" : `1. Analyse Posts (${unanalysedCount})`}
                    </button>
                  )}
                  <button
                    onClick={handleReport}
                    disabled={reporting}
                    className="text-[12px] px-3.5 py-2 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {reporting ? "Generating…" : "2. Generate Report"}
                  </button>
                </div>
              </div>
            )
          )}

          {/* Posts tab */}
          {activeTab === "posts" && (
            <div className="space-y-2">
              {[...posts].reverse().map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  launchId={launchId}
                  onAnalyse={postId => handleAnalyse(postId)}
                />
              ))}
            </div>
          )}

          {/* Recommendations tab */}
          {activeTab === "recommendations" && (
            <div className="space-y-2">
              {recommendations.length === 0 ? (
                <p className="text-[12px] text-muted-foreground/40 italic p-4 text-center">Generate a daily report to get AI recommendations</p>
              ) : (
                [...recommendations]
                  .sort((a, b) => {
                    const statusOrder = { pending: 0, accepted: 1, auto_apply: 2, ignored: 3 };
                    if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
                    const impactOrder = { high: 0, medium: 1, low: 2 };
                    return impactOrder[a.impact] - impactOrder[b.impact];
                  })
                  .map(rec => (
                    <RecommendationRow key={rec.id} rec={rec} launchId={launchId} onUpdated={fetchDept} />
                  ))
              )}
            </div>
          )}
        </>
      )}

      <p className="text-[11px] text-muted-foreground/30 text-center pt-1">
        Every insight feeds Business Memory · Every week the business becomes smarter
      </p>
    </div>
  );
}
