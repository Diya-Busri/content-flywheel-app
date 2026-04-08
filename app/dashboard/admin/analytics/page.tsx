"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Users, Zap, TrendingUp, Activity } from "lucide-react";

type TopEvent = { event: string; count: number };
type TopUser = { userId: string; email: string; count: number };
type DailyEvent = { day: string; count: number };
type ActiveUser = { userId: string; email: string | null; lastActiveAt: string | null; membership: string };

type AnalyticsData = {
  dau: number; wau: number; mau: number;
  topEvents: TopEvent[];
  topUsers: TopUser[];
  dailyEvents: DailyEvent[];
  recentlyActive: ActiveUser[];
};

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

function Sparkline({ data }: { data: DailyEvent[] }) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => Number(d.count)), 1);
  const w = 180; const h = 40;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (Number(d.count) / max) * h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} className="mt-2">
      <polyline points={pts} fill="none" stroke="#f97316" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/analytics");
    const json = (await res.json().catch(() => null)) as AnalyticsData | null;
    setData(json);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">User activity, engagement, and behaviour</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {loading || !data ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* DAU / WAU / MAU */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Daily Active Users", value: data.dau, icon: <Activity className="w-5 h-5" />, sub: "last 24h" },
              { label: "Weekly Active Users", value: data.wau, icon: <Users className="w-5 h-5" />, sub: "last 7 days" },
              { label: "Monthly Active Users", value: data.mau, icon: <TrendingUp className="w-5 h-5" />, sub: "last 30 days" },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</p>
                      <p className="text-3xl font-bold mt-1">{s.value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>
                    </div>
                    <div className="text-orange-500">{s.icon}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Sparkline + top events */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Events (last 14 days)</CardTitle>
              </CardHeader>
              <CardContent>
                <Sparkline data={data.dailyEvents} />
                {data.dailyEvents.length === 0 && (
                  <p className="text-sm text-muted-foreground">No events yet.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Top Features Used</CardTitle>
              </CardHeader>
              <CardContent>
                {data.topEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No events tracked yet.</p>
                ) : (
                  <div className="space-y-2">
                    {data.topEvents.map((e) => {
                      const label = EVENT_LABELS[e.event] ?? e.event;
                      const max = data.topEvents[0]?.count ?? 1;
                      const pct = Math.round((Number(e.count) / Number(max)) * 100);
                      return (
                        <div key={e.event}>
                          <div className="flex justify-between text-sm mb-1">
                            <span>{label}</span>
                            <span className="font-medium">{e.count}</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-orange-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Most active users */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Most Active Users (30 days)</CardTitle>
              </CardHeader>
              <CardContent>
                {data.topUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data yet.</p>
                ) : (
                  <div className="space-y-2">
                    {data.topUsers.map((u, i) => (
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

            {/* Recently active */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Recently Active Users</CardTitle>
              </CardHeader>
              <CardContent>
                {data.recentlyActive.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity in last 7 days.</p>
                ) : (
                  <div className="space-y-2">
                    {data.recentlyActive.map((u) => (
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
          </div>
        </>
      )}
    </div>
  );
}
