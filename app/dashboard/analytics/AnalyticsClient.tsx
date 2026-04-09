"use client";

import { useEffect, useState } from "react";

interface DailyRevenue {
  date: string;
  cents: number;
  orders: number;
}

interface TopProduct {
  productId: string;
  title: string;
  orders: number;
  revenueCents: number;
}

interface RecentOrder {
  id: string;
  buyerEmail: string;
  buyerName: string | null;
  amountCents: number;
  currency: string;
  createdAt: string;
  productTitle: string;
}

interface AnalyticsData {
  totalRevenueCents: number;
  totalOrders: number;
  last30DaysRevenueCents: number;
  last30DaysOrders: number;
  dailyRevenue: DailyRevenue[];
  topProducts: TopProduct[];
  recentOrders: RecentOrder[];
  subscriberCount: number;
}

function formatGBP(cents: number): string {
  return `£${(cents / 100).toFixed(2)}`;
}

function maskEmail(email: string): string {
  return email.replace(/(.{3}).*@/, "$1***@");
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AnalyticsClient() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/analytics/revenue")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
        } else {
          setData(d);
        }
      })
      .catch(() => setError("Failed to load analytics"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-gray-400 text-sm animate-pulse">Loading analytics...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-red-400 text-sm">{error ?? "No data available"}</div>
      </div>
    );
  }

  const maxDailyCents = Math.max(...data.dailyRevenue.map((d) => d.cents), 1);

  return (
    <div className="min-h-screen bg-background p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics & Revenue</h1>
          <p className="text-gray-400 text-sm mt-1">Track your sales performance and revenue</p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Revenue"
            value={formatGBP(data.totalRevenueCents)}
            accent
          />
          <StatCard
            label="Total Orders"
            value={String(data.totalOrders)}
          />
          <StatCard
            label="Last 30 Days"
            value={formatGBP(data.last30DaysRevenueCents)}
            sub={`${data.last30DaysOrders} orders`}
          />
          <StatCard
            label="Subscribers"
            value={String(data.subscriberCount)}
          />
        </div>

        {/* Revenue Chart */}
        <div className="bg-card border border-white/10 rounded-xl p-6">
          <h2 className="text-base font-semibold text-white mb-4">
            Revenue — Last 30 Days
          </h2>
          <div className="flex items-end gap-[3px] h-40 w-full">
            {data.dailyRevenue.map((day, i) => {
              const heightPct =
                day.cents === 0
                  ? 2
                  : Math.max(4, Math.round((day.cents / maxDailyCents) * 100));
              const showLabel = i % 5 === 0;
              return (
                <div
                  key={day.date}
                  className="flex flex-col items-center flex-1 gap-1 group relative"
                  title={`${day.date}: ${formatGBP(day.cents)} (${day.orders} orders)`}
                >
                  <div
                    className="w-full rounded-t-sm transition-all"
                    style={{
                      height: `${heightPct}%`,
                      backgroundColor:
                        day.cents > 0
                          ? "rgb(249,115,22)"
                          : "rgba(255,255,255,0.08)",
                    }}
                  />
                  {showLabel && (
                    <span className="text-[9px] text-gray-500 rotate-0 whitespace-nowrap hidden md:block">
                      {day.date.slice(5)}
                    </span>
                  )}
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-black border border-white/10 text-white text-[10px] px-2 py-1 rounded pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                    {day.date}<br />{formatGBP(day.cents)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-card border border-white/10 rounded-xl p-6">
          <h2 className="text-base font-semibold text-white mb-4">Top Products</h2>
          {data.topProducts.length === 0 ? (
            <p className="text-gray-500 text-sm">No sales yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-white/10">
                    <th className="text-left pb-3 font-medium">Product</th>
                    <th className="text-right pb-3 font-medium">Orders</th>
                    <th className="text-right pb-3 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.topProducts.map((p) => (
                    <tr key={p.productId} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 text-white font-medium truncate max-w-[220px]">
                        {p.title}
                      </td>
                      <td className="py-3 text-right text-gray-300">{p.orders}</td>
                      <td className="py-3 text-right text-orange-400 font-medium">
                        {formatGBP(p.revenueCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Orders */}
        <div className="bg-card border border-white/10 rounded-xl p-6">
          <h2 className="text-base font-semibold text-white mb-4">Recent Orders</h2>
          {data.recentOrders.length === 0 ? (
            <p className="text-gray-500 text-sm">No orders yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-white/10">
                    <th className="text-left pb-3 font-medium">Buyer</th>
                    <th className="text-left pb-3 font-medium hidden md:table-cell">Product</th>
                    <th className="text-right pb-3 font-medium">Amount</th>
                    <th className="text-right pb-3 font-medium hidden sm:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.recentOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 text-gray-300">{maskEmail(o.buyerEmail)}</td>
                      <td className="py-3 text-gray-400 hidden md:table-cell truncate max-w-[180px]">
                        {o.productTitle}
                      </td>
                      <td className="py-3 text-right text-orange-400 font-medium">
                        {formatGBP(o.amountCents)}
                      </td>
                      <td className="py-3 text-right text-gray-500 hidden sm:table-cell text-xs">
                        {formatDate(o.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-card border border-white/10 rounded-xl p-5">
      <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-2xl font-bold ${accent ? "text-orange-400" : "text-white"}`}>
        {value}
      </p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}
