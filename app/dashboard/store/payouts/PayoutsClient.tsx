"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, TrendingUp, Clock, CreditCard, Download, CheckCircle2, ArrowUpRight } from "lucide-react";

interface ConnectStatus {
  connected: boolean;
  accountId?: string;
  onboardingComplete?: boolean;
  chargesEnabled?: boolean;
}
interface StripeBalanceAmount { amount: number; currency: string; }
interface StripeBalance { available: StripeBalanceAmount[]; pending: StripeBalanceAmount[]; }
interface RecentOrder {
  id: string; buyerEmail: string; buyerName: string | null;
  amountCents: number; currency: string; createdAt: string; productTitle: string;
}
interface AnalyticsData {
  totalRevenueCents: number; totalOrders: number;
  last30DaysRevenueCents: number; last30DaysOrders: number;
  recentOrders: RecentOrder[];
}

function fmt(cents: number) { return `£${(cents / 100).toFixed(2)}`; }
function maskEmail(e: string) { return e.replace(/(.{3}).*@/, "$1***@"); }
function fmtDate(s: string) { return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
function balanceToGBP(amounts: StripeBalanceAmount[]) {
  const gbp = amounts.find((a) => a.currency === "gbp");
  if (gbp) return fmt(gbp.amount);
  const first = amounts[0];
  return first ? `${first.currency.toUpperCase()} ${(first.amount / 100).toFixed(2)}` : "£0.00";
}
function exportCSV(orders: RecentOrder[]) {
  const rows = orders.map((o) => [fmtDate(o.createdAt), maskEmail(o.buyerEmail), `"${o.productTitle.replace(/"/g, '""')}"`, (o.amountCents / 100).toFixed(2)].join(","));
  const csv = ["Date,Buyer Email,Product,Amount (GBP)", ...rows].join("\n");
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: `orders-${new Date().toISOString().slice(0, 10)}.csv` });
  a.click();
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
      fetch("/api/stripe/connect/status").then((r) => r.json()).then(setConnectStatus).catch(() => setConnectStatus({ connected: false })),
      fetch("/api/stripe/balance").then((r) => r.json()).then((d) => d.error ? setBalanceError(d.error) : setBalance(d)).catch(() => setBalanceError("Failed to load")),
      fetch("/api/analytics/revenue").then((r) => r.json()).then((d) => { if (!d.error) setAnalytics(d); }).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (searchParams.get("connect") === "done") loadData(); }, [searchParams, loadData]);

  const handleConnect = async () => {
    setConnectLoading(true);
    try {
      const res = await fetch("/api/stripe/connect/onboard", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);
      if (data.url) window.location.href = data.url;
    } catch (err) {
      alert(`Stripe Connect error: ${err instanceof Error ? err.message : "Unknown error"}. Check the browser console for details.`);
    } finally {
      setConnectLoading(false);
    }
  };

  const thisMonthCents = analytics?.recentOrders.filter((o) => new Date(o.createdAt) >= new Date(new Date().getFullYear(), new Date().getMonth(), 1)).reduce((s, o) => s + o.amountCents, 0) ?? 0;

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payouts</h1>
          <p className="text-gray-500 text-sm mt-1">Your Stripe balance and transaction history</p>
        </div>

        {/* Stripe Connect */}
        {connectStatus && !connectStatus.chargesEnabled && (
          <div className="bg-white border border-orange-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">
                  {connectStatus.connected && !connectStatus.onboardingComplete ? "Finish setting up your Stripe account" : "Connect Stripe to receive payments"}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {connectStatus.connected && !connectStatus.onboardingComplete
                    ? "You started onboarding but haven't finished. Complete it to enable payouts."
                    : "Buyers pay you directly via Stripe. ContentFlywheel charges a 5% platform fee per sale."}
                </p>
              </div>
            </div>
            <button onClick={handleConnect} disabled={connectLoading}
              className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors">
              {connectLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {connectLoading ? "Redirecting…" : connectStatus.connected ? "Resume Onboarding →" : "Connect Stripe →"}
            </button>
          </div>
        )}

        {connectStatus?.chargesEnabled && (
          <div className="bg-white border border-green-200 rounded-2xl px-5 py-3.5 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-gray-900">Stripe Connected</p>
              <p className="text-xs text-gray-500">Payments go directly to your Stripe account.</p>
            </div>
            <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer"
              className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors">
              Stripe Dashboard <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* Balance */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Stripe Balance</h2>
          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading balance…</div>
          ) : balanceError ? (
            <p className="text-red-500 text-sm">{balanceError}</p>
          ) : balance ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Available</p>
                <p className="text-2xl font-bold text-gray-900">{balanceToGBP(balance.available)}</p>
                <p className="text-xs text-gray-400 mt-1">Ready to pay out</p>
              </div>
              <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
                <p className="text-xs text-orange-400 uppercase tracking-wide mb-1">Pending</p>
                <p className="text-2xl font-bold text-orange-500">{balanceToGBP(balance.pending)}</p>
                <p className="text-xs text-orange-300 mt-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Processing (2–7 days)</p>
              </div>
            </div>
          ) : null}
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-400">Payouts sent automatically on your Stripe schedule.</p>
            <a href="https://dashboard.stripe.com/balance/overview" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors">
              Manage in Stripe <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Revenue stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "This Month", value: fmt(thisMonthCents), icon: TrendingUp, color: "text-gray-900" },
            { label: "Last 30 Days", value: fmt(analytics?.last30DaysRevenueCents ?? 0), icon: TrendingUp, color: "text-gray-900" },
            { label: "All Time", value: fmt(analytics?.totalRevenueCents ?? 0), icon: TrendingUp, color: "text-orange-500" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white border border-gray-200 rounded-2xl p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Fee info */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 text-sm text-blue-700">
          ContentFlywheel charges a <strong>5% platform fee</strong> per sale. You keep the rest, minus Stripe&apos;s standard processing fee (~1.5% + 20p per transaction).
        </div>

        {/* Transactions */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-gray-900">Transaction History</h2>
            {analytics && analytics.recentOrders.length > 0 && (
              <button onClick={() => exportCSV(analytics.recentOrders)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors">
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
          ) : !analytics || analytics.recentOrders.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <TrendingUp className="w-6 h-6 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-500">No transactions yet</p>
              <p className="text-xs text-gray-400 mt-1">Your sales will appear here once you make your first sale.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                    <th className="text-left pb-3 font-medium">Date</th>
                    <th className="text-left pb-3 font-medium">Buyer</th>
                    <th className="text-left pb-3 font-medium hidden md:table-cell">Product</th>
                    <th className="text-right pb-3 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {analytics.recentOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 text-xs text-gray-400">{fmtDate(o.createdAt)}</td>
                      <td className="py-3 text-sm text-gray-700">{maskEmail(o.buyerEmail)}</td>
                      <td className="py-3 text-sm text-gray-500 hidden md:table-cell truncate max-w-[180px]">{o.productTitle}</td>
                      <td className="py-3 text-right text-sm font-semibold text-orange-500">{fmt(o.amountCents)}</td>
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
