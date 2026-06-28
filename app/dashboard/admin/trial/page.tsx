"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, TrendingUp, TrendingDown, Users, Clock, AlertTriangle, CheckCircle2, Timer } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type Summary = {
  started: number;
  converted: number;
  cancelled: number;
  inTrial: number;
  lapsed: number;
  conversionRate: number;
  cancellationRate: number;
};

type CancelByDay = { day: number; count: number };

type TrialCancellation = {
  userId: string;
  email: string | null;
  trialStartedAt: string;
  trialCancelledAt: string;
  daysElapsed: number;
};

type TrialUser = {
  userId: string;
  email: string | null;
  trialStartedAt: string;
  trialEndsAt: string;
  daysRemaining: number;
  daysIn: number;
};

type DailyCount = { day: string; count: number };

type TrialData = {
  summary: Summary;
  cancelByDay: CancelByDay[];
  recentCancellations: TrialCancellation[];
  currentTrialUsers: TrialUser[];
  dailyStarts: DailyCount[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function dayLabel(day: number) {
  if (day === 0) return "Same day";
  if (day === 1) return "Day 1";
  if (day === 7) return "Day 7+";
  return `Day ${day}`;
}

function urgencyColor(daysRemaining: number) {
  if (daysRemaining <= 1) return "text-red-500";
  if (daysRemaining <= 3) return "text-orange-500";
  return "text-green-500";
}

function Sparkline({ data }: { data: DailyCount[] }) {
  if (!data.length) return <p className="text-sm text-muted-foreground">No trial starts yet.</p>;
  const max = Math.max(...data.map((d) => d.count), 1);
  const W = 200; const H = 44;
  const pts = data.map((d, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * W : W / 2;
    const y = H - (d.count / max) * (H - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  return (
    <div>
      <svg width={W} height={H} className="mt-2 w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <polyline points={pts} fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <p className="text-xs text-muted-foreground mt-1">last 30 days</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TrialAnalyticsPage() {
  const [data, setData] = useState<TrialData | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/analytics/trials");
    const json = (await res.json().catch(() => null)) as TrialData | null;
    setData(json);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const maxCancelCount = data ? Math.max(...(data.cancelByDay.map((d) => d.count)), 1) : 1;
  const noData = !data?.summary.started;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Trial Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">7-day free trial conversions, cancellations, and timing</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : noData ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Timer className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No trial data yet</p>
            <p className="text-sm mt-1">Trial tracking will begin when new subscriptions are created via Stripe.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── Summary stats ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Trial Starts", value: data!.summary.started, sub: "last 90 days", icon: <Users className="w-4 h-4" />, color: "text-blue-500" },
              { label: "Converted", value: data!.summary.converted, sub: `${data!.summary.conversionRate}% conversion rate`, icon: <CheckCircle2 className="w-4 h-4" />, color: "text-green-500" },
              { label: "Cancelled in Trial", value: data!.summary.cancelled, sub: `${data!.summary.cancellationRate}% cancellation rate`, icon: <TrendingDown className="w-4 h-4" />, color: data!.summary.cancellationRate > 50 ? "text-red-500" : "text-orange-500" },
              { label: "In Trial Now", value: data!.summary.inTrial, sub: "active trials", icon: <Clock className="w-4 h-4" />, color: "text-cyan-500" },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</p>
                      <p className="text-3xl font-bold mt-1">{s.value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>
                    </div>
                    <div className={s.color}>{s.icon}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Conversion funnel bar */}
          <Card>
            <CardContent className="pt-5 pb-5">
              <p className="text-sm font-medium mb-3">Trial Funnel (last 90 days)</p>
              <div className="space-y-3">
                {[
                  { label: "Started trial", value: data!.summary.started, pct: 100, color: "bg-blue-500" },
                  { label: "Converted to paid", value: data!.summary.converted, pct: data!.summary.started > 0 ? Math.round((data!.summary.converted / data!.summary.started) * 100) : 0, color: "bg-green-500" },
                  { label: "Cancelled during trial", value: data!.summary.cancelled, pct: data!.summary.started > 0 ? Math.round((data!.summary.cancelled / data!.summary.started) * 100) : 0, color: "bg-red-400" },
                  { label: "Trial lapsed (no action)", value: data!.summary.lapsed, pct: data!.summary.started > 0 ? Math.round((data!.summary.lapsed / data!.summary.started) * 100) : 0, color: "bg-gray-400" },
                  { label: "Still in trial", value: data!.summary.inTrial, pct: data!.summary.started > 0 ? Math.round((data!.summary.inTrial / data!.summary.started) * 100) : 0, color: "bg-cyan-400" },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{row.label}</span>
                      <span className="font-medium">{row.value} <span className="text-muted-foreground text-xs">({row.pct}%)</span></span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${row.color} rounded-full transition-all`} style={{ width: `${row.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ── Cancellation timing + sparkline ───────────────────────────── */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  When Do They Cancel?
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data!.cancelByDay.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No trial cancellations yet.</p>
                ) : (
                  <div className="space-y-3">
                    {Array.from({ length: 8 }, (_, i) => i).map((day) => {
                      const entry = data!.cancelByDay.find((d) => d.day === day);
                      const count = entry?.count ?? 0;
                      const pct = maxCancelCount > 0 ? Math.round((count / maxCancelCount) * 100) : 0;
                      const isWorrying = day === 0 && count > 0;
                      return (
                        <div key={day}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className={isWorrying ? "text-red-500 font-medium" : ""}>{dayLabel(day)}{isWorrying ? " ⚠️" : ""}</span>
                            <span className="font-medium">{count}</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${isWorrying ? "bg-red-500" : day <= 2 ? "bg-orange-500" : "bg-yellow-400"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-orange-500" />
                  Daily Trial Starts (30 days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Sparkline data={data!.dailyStarts} />
              </CardContent>
            </Card>
          </div>

          {/* ── People in trial right now ──────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-500" />
                Currently in Trial
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data!.currentTrialUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active trials right now.</p>
              ) : (
                <div className="space-y-0">
                  {data!.currentTrialUsers.map((u) => (
                    <div key={u.userId} className="flex items-center justify-between py-2 text-sm border-b border-border/40 last:border-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex flex-col min-w-0">
                          <span className="truncate font-medium">{u.email ?? u.userId}</span>
                          <span className="text-xs text-muted-foreground">Started {fmtDate(u.trialStartedAt)} · Day {u.daysIn} of 7</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${Math.min(((7 - u.daysRemaining) / 7) * 100, 100)}%` }} />
                        </div>
                        <span className={`text-xs font-medium ${urgencyColor(u.daysRemaining)}`}>{u.daysRemaining}d left</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Recent trial cancellations ─────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-red-500" />
                Recent Trial Cancellations
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data!.recentCancellations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No trial cancellations yet.</p>
              ) : (
                <div className="space-y-0">
                  {data!.recentCancellations.map((c) => (
                    <div key={c.userId} className="flex items-center justify-between py-2 text-sm border-b border-border/40 last:border-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex flex-col min-w-0">
                          <span className="truncate font-medium">{c.email ?? c.userId}</span>
                          <span className="text-xs text-muted-foreground">Started {fmtDate(c.trialStartedAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <Badge
                          variant={c.daysElapsed === 0 ? "destructive" : "outline"}
                          className="text-[10px]"
                        >
                          {c.daysElapsed === 0 ? "same day" : `day ${c.daysElapsed}`}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{timeAgo(c.trialCancelledAt)}</span>
                      </div>
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
