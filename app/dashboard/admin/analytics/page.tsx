"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Users, Zap, TrendingUp, Activity, Clock, Globe, Monitor, Smartphone, Tablet, Eye, ArrowUpRight } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type TopEvent = { event: string; count: number };
type TopUser = { userId: string; email: string; count: number };
type DailyCount = { day: string; count: number };
type ActiveUser = { userId: string; email: string | null; lastActiveAt: string | null; membership: string };

type EngagementData = {
  dau: number; wau: number; mau: number;
  topEvents: TopEvent[];
  topUsers: TopUser[];
  dailyEvents: DailyCount[];
  recentlyActive: ActiveUser[];
};

type LiveVisitor = {
  sessionId: string;
  userId: string | null;
  currentPage: string | null;
  durationSeconds: number;
  startedAt: string;
  device: string | null;
};

type SessionData = {
  visits: { today: number; thisWeek: number; thisMonth: number };
  avgDurationSeconds: number;
  avgPageViews: number;
  liveVisitors: LiveVisitor[];
  topPages: { page: string; views: number }[];
  deviceBreakdown: { device: string; count: number }[];
  newVsReturning: { isNew: boolean; count: number }[];
  dailyVisits: DailyCount[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  video_generated: "🎬 Video Generated",
  video_compiled: "🎞️ Video Compiled",
  ai_coach_used: "🤖 AI Coach Used",
  product_created: "📦 Product Created",
  template_used: "🎨 Template Used",
  page_view: "👁️ Page View",
};

function timeAgo(date: string | null) {
  if (!date) return "never";
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

function truncatePage(page: string | null): string {
  if (!page) return "/";
  const clean = page.replace(/^\/dashboard/, "").replace(/^\//, "") || "home";
  return clean.length > 40 ? clean.slice(0, 40) + "…" : clean;
}

function DeviceIcon({ device }: { device: string | null }) {
  if (device === "mobile") return <Smartphone className="w-3 h-3" />;
  if (device === "tablet") return <Tablet className="w-3 h-3" />;
  return <Monitor className="w-3 h-3" />;
}

function Sparkline({ data, color = "#f97316" }: { data: DailyCount[]; color?: string }) {
  if (!data.length) return <p className="text-sm text-muted-foreground">No data yet.</p>;
  const max = Math.max(...data.map((d) => Number(d.count)), 1);
  const W = 200; const H = 44;
  const pts = data.map((d, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * W : W / 2;
    const y = H - (Number(d.count) / max) * (H - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  const last = data[data.length - 1];
  return (
    <div>
      <svg width={W} height={H} className="mt-2 w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      {last && <p className="text-xs text-muted-foreground mt-1">{last.day}: {last.count} visits</p>}
    </div>
  );
}

function BarRow({ label, value, max, unit = "" }: { label: string; value: number; max: number; unit?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="truncate mr-2">{label}</span>
        <span className="font-medium shrink-0">{value}{unit}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminAnalyticsPage() {
  const [engagement, setEngagement] = useState<EngagementData | null>(null);
  const [sessions, setSessions] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [engRes, sesRes] = await Promise.allSettled([
      fetch("/api/admin/analytics").then((r) => r.json()),
      fetch("/api/admin/analytics/sessions").then((r) => r.json()),
    ]);
    setEngagement(engRes.status === "fulfilled" ? (engRes.value as EngagementData) : null);
    setSessions(sesRes.status === "fulfilled" ? (sesRes.value as SessionData) : null);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const newCount = sessions?.newVsReturning.find((r) => r.isNew)?.count ?? 0;
  const returningCount = sessions?.newVsReturning.find((r) => !r.isNew)?.count ?? 0;
  const totalNvR = newCount + returningCount || 1;
  const newPct = Math.round((newCount / totalNvR) * 100);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Visitors, sessions, engagement, and feature usage</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* ── Section 1: Visit counts ─────────────────────────────────────── */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Visits</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Today", value: sessions?.visits.today ?? 0, icon: <Eye className="w-4 h-4" />, sub: "sessions" },
                { label: "This Week", value: sessions?.visits.thisWeek ?? 0, icon: <TrendingUp className="w-4 h-4" />, sub: "sessions" },
                { label: "This Month", value: sessions?.visits.thisMonth ?? 0, icon: <Globe className="w-4 h-4" />, sub: "sessions" },
                { label: "Live Now", value: sessions?.liveVisitors.length ?? 0, icon: <Activity className="w-4 h-4 text-green-500" />, sub: "active users", highlight: true },
              ].map((s) => (
                <Card key={s.label} className={s.highlight && (sessions?.liveVisitors.length ?? 0) > 0 ? "border-green-500/40" : ""}>
                  <CardContent className="pt-5 pb-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</p>
                        <p className="text-3xl font-bold mt-1">{s.value}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>
                      </div>
                      <div className={s.highlight && (sessions?.liveVisitors.length ?? 0) > 0 ? "text-green-500" : "text-orange-500"}>{s.icon}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* ── Section 2: Session quality ──────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Avg Session Duration</p>
                    <p className="text-3xl font-bold mt-1">{formatDuration(sessions?.avgDurationSeconds ?? 0)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">last 30 days</p>
                  </div>
                  <Clock className="w-4 h-4 text-orange-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Pages / Session</p>
                    <p className="text-3xl font-bold mt-1">{sessions?.avgPageViews ?? 0}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">last 30 days</p>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-orange-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="col-span-2 md:col-span-1">
              <CardContent className="pt-5 pb-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">New vs Returning</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-3 rounded-full overflow-hidden bg-muted flex">
                    <div className="h-full bg-orange-500 transition-all" style={{ width: `${newPct}%` }} />
                  </div>
                </div>
                <div className="flex justify-between text-xs mt-2">
                  <span className="text-orange-500 font-medium">{newPct}% new ({newCount})</span>
                  <span className="text-muted-foreground">{100 - newPct}% returning ({returningCount})</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Section 3: DAU/WAU/MAU ─────────────────────────────────────── */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Active Users (feature events)</h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Daily Active", value: engagement?.dau ?? 0, sub: "last 24h" },
                { label: "Weekly Active", value: engagement?.wau ?? 0, sub: "last 7 days" },
                { label: "Monthly Active", value: engagement?.mau ?? 0, sub: "last 30 days" },
              ].map((s) => (
                <Card key={s.label}>
                  <CardContent className="pt-5 pb-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</p>
                        <p className="text-3xl font-bold mt-1">{s.value}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>
                      </div>
                      <Users className="w-4 h-4 text-orange-500" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* ── Section 4: Sparklines ───────────────────────────────────────── */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Daily Visits (14 days)</CardTitle>
              </CardHeader>
              <CardContent>
                <Sparkline data={sessions?.dailyVisits ?? []} color="#f97316" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Daily Feature Events (14 days)</CardTitle>
              </CardHeader>
              <CardContent>
                <Sparkline data={engagement?.dailyEvents ?? []} color="#6366f1" />
              </CardContent>
            </Card>
          </div>

          {/* ── Section 5: Top pages + devices ─────────────────────────────── */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Top Pages (30 days)</CardTitle>
              </CardHeader>
              <CardContent>
                {(sessions?.topPages ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No page data yet — visits will appear after users browse the dashboard.</p>
                ) : (
                  <div className="space-y-3">
                    {sessions!.topPages.map((p) => (
                      <BarRow key={p.page} label={truncatePage(p.page)} value={p.views} max={sessions!.topPages[0]?.views ?? 1} unit=" views" />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Devices</CardTitle>
              </CardHeader>
              <CardContent>
                {(sessions?.deviceBreakdown ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No device data yet.</p>
                ) : (
                  <div className="space-y-3">
                    {sessions!.deviceBreakdown
                      .sort((a, b) => b.count - a.count)
                      .map((d) => {
                        const icon = d.device === "mobile" ? "📱" : d.device === "tablet" ? "📟" : "💻";
                        return (
                          <BarRow key={d.device} label={`${icon} ${d.device}`} value={d.count} max={Math.max(...sessions!.deviceBreakdown.map((x) => x.count))} unit=" sessions" />
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Section 6: Live visitors ────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                  Live Visitors
                </CardTitle>
                <span className="text-xs text-muted-foreground">active in last 5 min</span>
              </div>
            </CardHeader>
            <CardContent>
              {(sessions?.liveVisitors ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No active visitors right now.</p>
              ) : (
                <div className="space-y-2">
                  {sessions!.liveVisitors.map((v) => (
                    <div key={v.sessionId} className="flex items-center justify-between text-sm py-1 border-b border-border/40 last:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <DeviceIcon device={v.device} />
                        <span className="truncate text-muted-foreground">{truncatePage(v.currentPage)}</span>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">{formatDuration(v.durationSeconds)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Section 7: Top features + most active users ─────────────────── */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Top Features Used (30 days)</CardTitle>
              </CardHeader>
              <CardContent>
                {(engagement?.topEvents ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No feature events tracked yet.</p>
                ) : (
                  <div className="space-y-3">
                    {engagement!.topEvents.map((e) => (
                      <BarRow
                        key={e.event}
                        label={EVENT_LABELS[e.event] ?? e.event}
                        value={Number(e.count)}
                        max={Number(engagement!.topEvents[0]?.count ?? 1)}
                        unit=" uses"
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="w-4 h-4 text-orange-500" />
                  Power Users (30 days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(engagement?.topUsers ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data yet.</p>
                ) : (
                  <div className="space-y-2">
                    {engagement!.topUsers.map((u, i) => (
                      <div key={u.userId} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                          <span className="truncate">{u.email}</span>
                        </div>
                        <span className="font-medium shrink-0 ml-2">{u.count} events</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Section 8: Recently active ──────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Recently Active Users (7 days)</CardTitle>
            </CardHeader>
            <CardContent>
              {(engagement?.recentlyActive ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity in last 7 days.</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                  {engagement!.recentlyActive.map((u) => (
                    <div key={u.userId} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant={u.membership === "pro" ? "default" : "secondary"} className="text-[10px] shrink-0">
                          {u.membership}
                        </Badge>
                        <span className="truncate">{u.email ?? u.userId}</span>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">{timeAgo(u.lastActiveAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
