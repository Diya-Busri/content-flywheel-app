"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";

interface ConnectStatus {
  connected: boolean;
  accountId?: string;
  onboardingComplete?: boolean;
  chargesEnabled?: boolean;
}

interface StripeBalanceAmount {
  amount: number;
  currency: string;
}

interface StripeBalance {
  available: StripeBalanceAmount[];
  pending: StripeBalanceAmount[];
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
  recentOrders: RecentOrder[];
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

function amountsToGBP(amounts: StripeBalanceAmount[]): string {
  const gbp = amounts.find((a) => a.currency === "gbp");
  if (!gbp) {
    // Fall back to first currency
    const first = amounts[0];
    if (!first) return "£0.00";
    return `${first.currency.toUpperCase()} ${(first.amount / 100).toFixed(2)}`;
  }
  return formatGBP(gbp.amount);
}

function exportCSV(orders: RecentOrder[]) {
  const header = ["Date", "Buyer Email", "Product", "Amount (GBP)"].join(",");
  const rows = orders.map((o) =>
    [
      formatDate(o.createdAt),
      maskEmail(o.buyerEmail),
      `"${o.productTitle.replace(/"/g, '""')}"`,
      (o.amountCents / 100).toFixed(2),
    ].join(",")
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PayoutsClient() {
  const [balance, setBalance] = useState<StripeBalance | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);
  const searchParams = useSearchParams();

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/stripe/connect/status")
        .then((r) => r.json())
        .then((d) => setConnectStatus(d))
        .catch(() => setConnectStatus({ connected: false })),
      fetch("/api/stripe/balance")
        .then((r) => r.json())
        .then((d) => {
          if (d.error) setBalanceError(d.error);
          else setBalance(d);
        })
        .catch(() => setBalanceError("Failed to load balance")),
      fetch("/api/analytics/revenue")
        .then((r) => r.json())
        .then((d) => {
          if (!d.error) setAnalytics(d);
        })
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Re-fetch when returning from Stripe onboarding
  useEffect(() => {
    if (searchParams.get("connect") === "done") {
      loadData();
    }
  }, [searchParams, loadData]);

  const handleConnectStripe = async () => {
    setConnectLoading(true);
    try {
      const res = await fetch("/api/stripe/connect/onboard", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      alert("Failed to start Stripe Connect. Please try again.");
    } finally {
      setConnectLoading(false);
    }
  };

  // This month revenue
  const thisMonthCents = (() => {
    if (!analytics) return 0;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return analytics.recentOrders
      .filter((o) => new Date(o.createdAt) >= monthStart)
      .reduce((sum, o) => sum + o.amountCents, 0);
  })();

  return (
    <div className="min-h-screen bg-background p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Payouts &amp; Financial Overview</h1>
          <p className="text-gray-400 text-sm mt-1">
            Your Stripe balance and transaction history
          </p>
        </div>

        {/* Stripe Connect Banner */}
        {connectStatus && !connectStatus.chargesEnabled && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-orange-400 font-semibold text-sm">
                {connectStatus.connected && !connectStatus.onboardingComplete
                  ? "⚠️ Finish setting up your Stripe account"
                  : "💳 Connect Stripe to start receiving payments"}
              </p>
              <p className="text-gray-400 text-xs mt-1">
                {connectStatus.connected && !connectStatus.onboardingComplete
                  ? "You started onboarding but haven't finished. Complete it to enable payouts."
                  : "Connect your Stripe account so buyers can pay you directly. ContentFlywheel charges a 5% platform fee per sale."}
              </p>
            </div>
            <button
              onClick={handleConnectStripe}
              disabled={connectLoading}
              className="shrink-0 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {connectLoading
                ? "Redirecting…"
                : connectStatus.connected
                ? "Resume Onboarding →"
                : "Connect Stripe →"}
            </button>
          </div>
        )}

        {connectStatus?.chargesEnabled && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-5 py-3 flex items-center gap-3">
            <span className="text-green-400 text-lg">✓</span>
            <div>
              <p className="text-green-400 font-semibold text-sm">Stripe Connected</p>
              <p className="text-gray-400 text-xs">Payments go directly to your Stripe account.</p>
            </div>
            <a
              href={`https://dashboard.stripe.com`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Stripe Dashboard →
            </a>
          </div>
        )}

        {/* Balance Card */}
        <div className="bg-card border border-white/10 rounded-xl p-6">
          <h2 className="text-base font-semibold text-white mb-4">Stripe Balance</h2>
          {loading ? (
            <p className="text-gray-400 text-sm animate-pulse">Loading balance...</p>
          ) : balanceError ? (
            <p className="text-red-400 text-sm">{balanceError}</p>
          ) : balance ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-lg p-4">
                <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Available</p>
                <p className="text-white font-bold text-2xl">
                  {amountsToGBP(balance.available)}
                </p>
                <p className="text-gray-500 text-xs mt-1">Ready to pay out</p>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Pending</p>
                <p className="text-orange-400 font-bold text-2xl">
                  {amountsToGBP(balance.pending)}
                </p>
                <p className="text-gray-500 text-xs mt-1">Processing (2-7 days)</p>
              </div>
            </div>
          ) : null}

          <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
            <p className="text-gray-400 text-sm">
              Payouts are sent automatically to your bank account on your Stripe payout schedule.
            </p>
            <a
              href="https://dashboard.stripe.com/balance/overview"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Manage in Stripe Dashboard &rarr;
            </a>
          </div>
        </div>

        {/* Revenue Breakdown */}
        <div className="bg-card border border-white/10 rounded-xl p-6">
          <h2 className="text-base font-semibold text-white mb-4">Revenue Breakdown</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-white/5 rounded-lg p-4">
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">This Month</p>
              <p className="text-white font-bold text-xl">{formatGBP(thisMonthCents)}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-4">
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Last 30 Days</p>
              <p className="text-white font-bold text-xl">
                {formatGBP(analytics?.last30DaysRevenueCents ?? 0)}
              </p>
            </div>
            <div className="bg-white/5 rounded-lg p-4">
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">All Time</p>
              <p className="text-orange-400 font-bold text-xl">
                {formatGBP(analytics?.totalRevenueCents ?? 0)}
              </p>
            </div>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-sm text-blue-200">
            ContentFlywheel charges a 5% platform fee per sale. You keep the rest, minus Stripe&apos;s standard processing fee (~1.5% + 20p per transaction).
          </div>
        </div>

        {/* Transaction History */}
        <div className="bg-card border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Transaction History</h2>
            {analytics && analytics.recentOrders.length > 0 && (
              <button
                type="button"
                onClick={() => exportCSV(analytics.recentOrders)}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-lg transition-colors"
              >
                Export CSV
              </button>
            )}
          </div>

          {loading ? (
            <p className="text-gray-400 text-sm animate-pulse">Loading transactions...</p>
          ) : !analytics || analytics.recentOrders.length === 0 ? (
            <p className="text-gray-500 text-sm">No transactions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-white/10">
                    <th className="text-left pb-3 font-medium">Date</th>
                    <th className="text-left pb-3 font-medium">Buyer</th>
                    <th className="text-left pb-3 font-medium hidden md:table-cell">Product</th>
                    <th className="text-right pb-3 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {analytics.recentOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 text-gray-500 text-xs">{formatDate(o.createdAt)}</td>
                      <td className="py-3 text-gray-300">{maskEmail(o.buyerEmail)}</td>
                      <td className="py-3 text-gray-400 hidden md:table-cell truncate max-w-[180px]">
                        {o.productTitle}
                      </td>
                      <td className="py-3 text-right text-orange-400 font-medium">
                        {formatGBP(o.amountCents)}
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
