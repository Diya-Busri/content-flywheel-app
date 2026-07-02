"use client";

import { useEffect, useState, useCallback } from "react";
import { TrendingUp, TrendingDown, Download, RefreshCw } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = "7" | "30" | "90" | "all";

interface DailyRevenue { date: string; cents: number; orders: number; }
interface TopProduct   { productId: string; title: string; orders: number; revenueCents: number; }
interface RecentOrder  { id: string; buyerEmail: string; buyerName: string | null; amountCents: number; currency: string; createdAt: string; productTitle: string; }

interface AnalyticsData {
  totalRevenueCents: number;
  totalOrders: number;
  periodRevenueCents: number;
  periodOrdersCount: number;
  avgOrderCents: number;
  revenueTrend: number;
  prevPeriodRevenueCents: number;
  // legacy
  last30DaysRevenueCents: number;
  last30DaysOrders: number;
  dailyRevenue: DailyRevenue[];
  topProducts: TopProduct[];
  recentOrders: RecentOrder[];
  allOrdersForExport: RecentOrder[];
  subscriberCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function gbp(cents: number) { return `£${(cents / 100).toFixed(2)}`; }
function maskEmail(e: string) { return e.replace(/(.{3}).*@/, "$1***@"); }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }

function exportCSV(orders: RecentOrder[], period: Period) {
  const header = ["Date", "Buyer Email", "Buyer Name", "Product", "Amount (£)"];
  const rows = orders.map(o => [
    fmtDate(o.createdAt),
    o.buyerEmail,
    o.buyerName ?? "",
    o.productTitle,
    (o.amountCents / 100).toFixed(2),
  ]);
  const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `revenue-${period === "all" ? "all-time" : `last-${period}d`}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`rounded-lg bg-muted/40 animate-pulse ${className ?? ""}`} />
  );
}

function SkeletonDashboard() {
  return (
    <div className="min-h-screen bg-background p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-2"><Skeleton className="h-7 w-48" /><Skeleton className="h-4 w-64" /></div>
          <Skeleton className="h-9 w-36 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="bg-card border border-border rounded-xl p-5 space-y-3"><Skeleton className="h-3 w-24" /><Skeleton className="h-8 w-32" /><Skeleton className="h-3 w-16" /></div>)}
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <Skeleton className="h-5 w-40 mb-6" />
          <div className="flex items-end gap-[3px] h-40">
            {Array.from({ length: 30 }).map((_, i) => (
              <div key={i} className="flex-1 rounded-t-sm bg-muted/40 animate-pulse" style={{ height: `${20 + Math.random() * 60}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Trend badge ──────────────────────────────────────────────────────────────

function TrendBadge({ pct, period }: { pct: number; period: Period }) {
  if (period === "all") return null;
  const up = pct > 0;
  const flat = pct === 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
      flat ? "bg-muted text-muted-foreground" :
      up    ? "bg-green-500/15 text-green-400" :
              "bg-red-500/15 text-red-400"
    }`}>
      {!flat && (up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />)}
      {flat ? "Flat" : `${up ? "+" : ""}${pct}%`}
      <span className="opacity-60">vs prev</span>
    </span>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent, trend, period }: {
  label: string; value: string; sub?: string;
  accent?: boolean; trend?: number; period?: Period;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-2xl font-bold leading-none mb-1 ${accent ? "text-orange-400" : "text-foreground"}`}>{value}</p>
      <div className="flex items-center gap-2 flex-wrap mt-1">
        {sub && <p className="text-muted-foreground text-xs">{sub}</p>}
        {trend !== undefined && period !== undefined && <TrendBadge pct={trend} period={period} />}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const PERIODS: { id: Period; label: string }[] = [
  { id: "7",   label: "7 days" },
  { id: "30",  label: "30 days" },
  { id: "90",  label: "90 days" },
  { id: "all", label: "All time" },
];

export default function AnalyticsClient() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("30");

  const load = useCallback(async (p: Period, isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/analytics/revenue?period=${p}`);
      const d = await r.json();
      if (d.error) setError(d.error);
      else setData(d);
    } catch {
      setError("Failed to load analytics");
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(period); }, [period, load]);

  if (loading) return <SkeletonDashboard />;

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-red-400 text-sm">{error ?? "No data available"}</p>
      </div>
    );
  }

  const maxDailyCents = Math.max(...data.dailyRevenue.map(d => d.cents), 1);
  const maxProductRev = Math.max(...data.topProducts.map(p => p.revenueCents), 1);

  const periodLabel = period === "all" ? "All time" : `Last ${period} days`;
  const prevLabel   = period === "all" ? "" : `vs prev ${period}d`;

  return (
    <div className="min-h-screen bg-background p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Analytics & Revenue</h1>
            <p className="text-muted-foreground text-sm mt-1">Track your sales performance and revenue</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Period selector */}
            <div className="flex bg-muted/30 border border-border rounded-xl p-1 gap-0.5">
              {PERIODS.map(p => (
                <button key={p.id} onClick={() => setPeriod(p.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    period === p.id ? "bg-orange-500 text-white shadow" : "text-muted-foreground hover:text-foreground"
                  }`}>
                  {p.label}
                </button>
              ))}
            </div>
            {/* Refresh */}
            <button onClick={() => load(period, true)} disabled={refreshing}
              className="flex items-center gap-1.5 h-9 px-3 text-xs font-semibold text-muted-foreground hover:text-foreground border border-border rounded-xl transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            {/* CSV export */}
            <button onClick={() => exportCSV(data.allOrdersForExport ?? data.recentOrders, period)}
              className="flex items-center gap-1.5 h-9 px-3 text-xs font-semibold text-muted-foreground hover:text-foreground border border-border rounded-xl transition-colors">
              <Download className="w-3.5 h-3.5" />Export CSV
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label={`${periodLabel} Revenue`}
            value={gbp(data.periodRevenueCents ?? data.last30DaysRevenueCents)}
            sub={`${data.periodOrdersCount ?? data.last30DaysOrders} orders`}
            accent
            trend={data.revenueTrend}
            period={period}
          />
          <StatCard
            label="All-time Revenue"
            value={gbp(data.totalRevenueCents)}
            sub={`${data.totalOrders} orders total`}
          />
          <StatCard
            label="Avg Order Value"
            value={gbp(data.avgOrderCents ?? 0)}
            sub={periodLabel}
            trend={undefined}
          />
          <StatCard
            label="Subscribers"
            value={String(data.subscriberCount)}
            sub="active list"
          />
        </div>

        {/* Revenue chart */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
            <h2 className="text-base font-semibold text-foreground">
              Revenue — <span className="text-orange-400">{periodLabel}</span>
            </h2>
            {data.revenueTrend !== undefined && period !== "all" && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {prevLabel}:&nbsp;
                <span className="text-foreground/70 font-medium">{gbp(data.prevPeriodRevenueCents ?? 0)}</span>
                <TrendBadge pct={data.revenueTrend} period={period} />
              </div>
            )}
          </div>
          <div className="flex items-end gap-[2px] h-36 w-full">
            {data.dailyRevenue.map((day, i) => {
              const h = day.cents === 0 ? 2 : Math.max(4, Math.round((day.cents / maxDailyCents) * 100));
              const n = data.dailyRevenue.length;
              const step = n <= 14 ? 2 : n <= 31 ? 5 : 10;
              const showLabel = i % step === 0;
              return (
                <div key={day.date} className="flex flex-col items-center flex-1 gap-1 group relative" title={`${day.date}: ${gbp(day.cents)} (${day.orders} orders)`}>
                  <div
                    className={`w-full rounded-t-sm transition-all duration-300 ${day.cents > 0 ? "bg-orange-500" : "bg-muted/40"}`}
                    style={{ height: `${h}%` }}
                  />
                  {showLabel && <span className="text-[9px] text-muted-foreground/50 whitespace-nowrap hidden md:block">{day.date.slice(5)}</span>}
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-popover border border-border text-foreground text-[10px] px-2 py-1.5 rounded-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-xl">
                    <p className="font-semibold">{gbp(day.cents)}</p>
                    <p className="text-muted-foreground">{day.date} · {day.orders} {day.orders === 1 ? "order" : "orders"}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top products + Recent orders — side by side on wide screens */}
        <div className="grid lg:grid-cols-2 gap-6">

          {/* Top products */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-base font-semibold text-foreground mb-5">Top Products</h2>
            {data.topProducts.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-muted-foreground text-sm">No sales yet in this period.</p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {data.topProducts.slice(0, 8).map((p, i) => {
                  const barW = Math.max(3, Math.round((p.revenueCents / maxProductRev) * 100));
                  return (
                    <div key={p.productId} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] font-bold text-muted-foreground/50 w-4 text-right shrink-0">{i + 1}</span>
                          <p className="text-sm text-foreground font-medium truncate">{p.title}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs text-muted-foreground">{p.orders} sales</span>
                          <span className="text-sm font-bold text-orange-400">{gbp(p.revenueCents)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden ml-6">
                        <div className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all duration-500" style={{ width: `${barW}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent orders */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-base font-semibold text-foreground mb-5">Recent Orders</h2>
            {data.recentOrders.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-muted-foreground text-sm">No orders yet in this period.</p>
              </div>
            ) : (
              <div className="space-y-0 divide-y divide-border/50">
                {data.recentOrders.slice(0, 10).map(o => (
                  <div key={o.id} className="flex items-center gap-3 py-2.5 hover:bg-muted/20 transition-colors -mx-1 px-1 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground font-medium truncate">{maskEmail(o.buyerEmail)}</p>
                      <p className="text-xs text-muted-foreground truncate">{o.productTitle}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-orange-400">{gbp(o.amountCents)}</p>
                      <p className="text-[10px] text-muted-foreground/60">{fmtDate(o.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
