"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, TrendingUp, Users, CreditCard, Film } from "lucide-react";

type TxRow = {
  id: string;
  userId: string;
  type: "purchase" | "usage";
  amount: number;
  description: string;
  createdAt: string;
};

type UsageByType = {
  description: string;
  total: string | null;
  txCount: string | null;
};

type StripeCharge = {
  id: string;
  amount: number;
  currency: string;
  created: number;
  email: string | null;
  status: string;
};

type RevenueData = {
  creditsPurchased: number;
  purchaseCount: number;
  creditsUsed: number;
  usageCount: number;
  totalUsers: number;
  proUsers: number;
  recentTransactions: TxRow[];
  usageByType: UsageByType[];
  stripeCharges: StripeCharge[];
};

function StatCard({ label, value, sub, icon }: { label: string; value: string | number; sub?: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className="text-orange-500">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function timeAgo(date: string | number) {
  const diff = Date.now() - new Date(typeof date === "number" ? date * 1000 : date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AdminRevenuePage() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/revenue");
    const json = (await res.json().catch(() => null)) as RevenueData | null;
    setData(json);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Revenue & Business</h1>
          <p className="text-sm text-muted-foreground mt-1">Credit purchases, usage, and Stripe payments</p>
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
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Credits Purchased" value={data.creditsPurchased} sub={`${data.purchaseCount} transactions`} icon={<CreditCard className="w-5 h-5" />} />
            <StatCard label="Credits Used" value={data.creditsUsed} sub={`${data.usageCount} videos`} icon={<Film className="w-5 h-5" />} />
            <StatCard label="Total Users" value={data.totalUsers} icon={<Users className="w-5 h-5" />} />
            <StatCard label="Pro Users" value={data.proUsers} sub={`${data.totalUsers ? Math.round((data.proUsers / data.totalUsers) * 100) : 0}% of users`} icon={<TrendingUp className="w-5 h-5" />} />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Usage by video type */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Usage by Video Type</CardTitle>
              </CardHeader>
              <CardContent>
                {data.usageByType.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No usage yet.</p>
                ) : (
                  <div className="space-y-2">
                    {data.usageByType.map((row) => (
                      <div key={row.description} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{row.description}</span>
                        <div className="flex gap-3">
                          <span className="font-medium">{row.total ?? 0} credits</span>
                          <span className="text-muted-foreground">{row.txCount ?? 0}×</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stripe charges */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Recent Stripe Charges</CardTitle>
              </CardHeader>
              <CardContent>
                {data.stripeCharges.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No charges or Stripe key not configured.</p>
                ) : (
                  <div className="space-y-2">
                    {data.stripeCharges.map((c) => (
                      <div key={c.id} className="flex items-center justify-between text-sm">
                        <div>
                          <p className="font-medium">{c.email ?? "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">{timeAgo(c.created)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">£{(c.amount / 100).toFixed(2)}</p>
                          <Badge variant={c.status === "succeeded" ? "default" : "destructive"} className="text-[10px]">
                            {c.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent transactions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Recent Credit Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {data.recentTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between text-sm py-1 border-b border-border/40 last:border-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`font-semibold shrink-0 ${tx.type === "purchase" ? "text-green-500" : "text-orange-500"}`}>
                        {tx.type === "purchase" ? `+${tx.amount}` : `-${tx.amount}`}
                      </span>
                      <span className="text-muted-foreground truncate">{tx.description}</span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">{timeAgo(tx.createdAt)}</span>
                  </div>
                ))}
                {data.recentTransactions.length === 0 && (
                  <p className="text-sm text-muted-foreground">No transactions yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
