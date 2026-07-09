"use client";

import { useState, useEffect, useCallback } from "react";
import { Award, Users, Star, Zap, BarChart2, Shield, X, Check, RefreshCw, ChevronDown } from "lucide-react";

interface CreditEvent {
  id: string; userId: string; type: string;
  amountCredits: number; description: string;
  createdAt: string; adminUserId: string | null;
}

interface Referral {
  id: string; referrerUserId: string; referredUserId: string;
  referredEmail: string | null; status: string;
  createdAt: string; convertedAt: string | null; creditAwardedAt: string | null;
}

interface FeaturedProduct {
  id: string; productId: string; userId: string;
  niche: string; featuredUntil: string | null; createdAt: string;
}

interface CreatorScore {
  userId: string; score: number; level: string;
  salesCount: number; revenueGbp: number;
  avgRating: number; leaderboardOptIn: boolean;
}

interface AdminData {
  recentEvents: CreditEvent[];
  referralChains: Referral[];
  activeFeatured: FeaturedProduct[];
  topScores: CreatorScore[];
}

type AdminTab = "overview" | "credits" | "referrals" | "featured" | "leaderboard";

const TABS: { id: AdminTab; label: string; icon: typeof Award }[] = [
  { id: "overview",   label: "Overview",   icon: BarChart2 },
  { id: "credits",    label: "Credits",    icon: Zap        },
  { id: "referrals",  label: "Referrals",  icon: Users      },
  { id: "featured",   label: "Featured",   icon: Star       },
  { id: "leaderboard",label: "Leaderboard",icon: Award      },
];

const STATUS_COLORS: Record<string, string> = {
  pending_signup:    "text-gray-400",
  trial_active:      "text-blue-400",
  product_published: "text-purple-400",
  pro_converted:     "text-orange-400",
  credit_awarded:    "text-green-400",
  expired:           "text-gray-500",
  rejected:          "text-red-400",
};

export default function AdminRewardsPage() {
  const [tab, setTab]     = useState<AdminTab>("overview");
  const [data, setData]   = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState("");

  // Manual credit form
  const [manualTarget, setManualTarget]       = useState("");
  const [manualAmount, setManualAmount]       = useState("");
  const [manualDesc, setManualDesc]           = useState("");
  const [manualSaving, setManualSaving]       = useState(false);

  // POTW form
  const [potwTarget, setPotwTarget]   = useState("");
  const [potwWeekId, setPotwWeekId]   = useState("");
  const [potwSaving, setPotwSaving]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/rewards").then((r) => r.json()) as AdminData;
      setData(res);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const doAction = async (action: string, body: Record<string, unknown>) => {
    const res = await fetch("/api/admin/rewards", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const d = await res.json() as { ok?: boolean; error?: string };
    if (d.ok) { setActionMsg("✅ Done"); load(); }
    else setActionMsg(`❌ ${d.error ?? "Error"}`);
    setTimeout(() => setActionMsg(""), 3000);
  };

  const manualCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualSaving(true);
    await doAction("manual-credit", { targetUserId: manualTarget, amountCredits: parseFloat(manualAmount), description: manualDesc });
    setManualTarget(""); setManualAmount(""); setManualDesc("");
    setManualSaving(false);
  };

  const potwAward = async (e: React.FormEvent) => {
    e.preventDefault();
    setPotwSaving(true);
    await doAction("potw", { targetUserId: potwTarget, weekId: potwWeekId });
    setPotwTarget(""); setPotwWeekId("");
    setPotwSaving(false);
  };

  if (loading) return (
    <div className="p-8 text-center text-sm text-gray-400">Loading rewards data…</div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Creator Rewards</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage credits, referrals, featured slots, and leaderboard</p>
        </div>
        <div className="flex items-center gap-2">
          {actionMsg && <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{actionMsg}</span>}
          <button onClick={load} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.04]">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-white/[0.08]">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border-b-2 transition-colors -mb-px ${tab === t.id ? "border-violet-600 text-violet-600 dark:text-violet-400" : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700"}`}>
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Credit Events",    value: data?.recentEvents.length ?? 0,   color: "text-violet-600" },
            { label: "Total Referrals",  value: data?.referralChains.length ?? 0, color: "text-blue-600"   },
            { label: "Active Featured",  value: data?.activeFeatured.length ?? 0, color: "text-amber-600"  },
            { label: "Scored Creators",  value: data?.topScores.length ?? 0,      color: "text-green-600"  },
          ].map((s) => (
            <div key={s.label} className="bg-white dark:bg-white/[0.04] border border-gray-100 dark:border-white/[0.08] rounded-xl p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{s.label}</p>
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Credits tab */}
      {tab === "credits" && (
        <div className="space-y-6">
          {/* Manual credit form */}
          <div className="bg-white dark:bg-white/[0.04] border border-gray-100 dark:border-white/[0.08] rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Award / Revoke Credits</h3>
            <form onSubmit={manualCredit} className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Creator User ID</label>
                <input required value={manualTarget} onChange={(e) => setManualTarget(e.target.value)}
                  placeholder="user_abc123"
                  className="text-sm border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 bg-white dark:bg-[#1A1A1A] w-56 focus:outline-none focus:border-violet-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Amount (use − to revoke)</label>
                <input required value={manualAmount} onChange={(e) => setManualAmount(e.target.value)}
                  placeholder="+1.0 or −1.0" type="number" step="0.25"
                  className="text-sm border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 bg-white dark:bg-[#1A1A1A] w-32 focus:outline-none focus:border-violet-400" />
              </div>
              <div className="flex-1 min-w-48">
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Reason</label>
                <input required value={manualDesc} onChange={(e) => setManualDesc(e.target.value)}
                  placeholder="e.g. Community challenge completion"
                  className="text-sm border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 bg-white dark:bg-[#1A1A1A] w-full focus:outline-none focus:border-violet-400" />
              </div>
              <button type="submit" disabled={manualSaving}
                className="text-sm font-bold px-4 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors">
                {manualSaving ? "Saving…" : "Award"}
              </button>
            </form>
          </div>

          {/* POTW form */}
          <div className="bg-white dark:bg-white/[0.04] border border-gray-100 dark:border-white/[0.08] rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">🏆 Product of the Week (+2 credits)</h3>
            <form onSubmit={potwAward} className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Creator User ID</label>
                <input required value={potwTarget} onChange={(e) => setPotwTarget(e.target.value)}
                  placeholder="user_abc123"
                  className="text-sm border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 bg-white dark:bg-[#1A1A1A] w-56 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Week ID (e.g. 2026-W28)</label>
                <input required value={potwWeekId} onChange={(e) => setPotwWeekId(e.target.value)}
                  placeholder="2026-W28"
                  className="text-sm border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 bg-white dark:bg-[#1A1A1A] w-36 focus:outline-none" />
              </div>
              <button type="submit" disabled={potwSaving}
                className="text-sm font-bold px-4 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors">
                {potwSaving ? "Awarding…" : "Award POTW"}
              </button>
            </form>
          </div>

          {/* Recent credit events */}
          <div className="bg-white dark:bg-white/[0.04] border border-gray-100 dark:border-white/[0.08] rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-white/[0.06]">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Recent Credit Events</h3>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-white/[0.05] max-h-96 overflow-y-auto">
              {(data?.recentEvents ?? []).slice(0, 50).map((e) => (
                <div key={e.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-gray-400 truncate">{e.userId}</p>
                    <p className="text-sm text-gray-900 dark:text-white truncate">{e.description}</p>
                    <p className="text-xs text-gray-400">{e.type} · {new Date(e.createdAt).toLocaleDateString("en-GB")}</p>
                  </div>
                  <span className={`text-sm font-bold flex-shrink-0 ${e.amountCredits >= 0 ? "text-green-500" : "text-red-400"}`}>
                    {e.amountCredits >= 0 ? "+" : ""}{e.amountCredits.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Referrals tab */}
      {tab === "referrals" && (
        <div className="bg-white dark:bg-white/[0.04] border border-gray-100 dark:border-white/[0.08] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-white/[0.06]">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Referral Chains ({data?.referralChains.length ?? 0})</h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-white/[0.05] max-h-[70vh] overflow-y-auto">
            {(data?.referralChains ?? []).map((r) => (
              <div key={r.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 font-mono truncate">Referrer: {r.referrerUserId}</p>
                  <p className="text-xs text-gray-400 font-mono truncate">Referred: {r.referredEmail ?? r.referredUserId}</p>
                  <p className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString("en-GB")}</p>
                </div>
                <span className={`text-xs font-semibold ${STATUS_COLORS[r.status] ?? "text-gray-400"}`}>{r.status.replace(/_/g, " ")}</span>
                {!["credit_awarded","expired","rejected"].includes(r.status) && (
                  <button onClick={() => doAction("reject-referral", { referralId: r.id })}
                    className="text-xs text-red-400 hover:text-red-600 font-semibold flex-shrink-0">
                    Reject
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Featured tab */}
      {tab === "featured" && (
        <div className="bg-white dark:bg-white/[0.04] border border-gray-100 dark:border-white/[0.08] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-white/[0.06]">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Active Featured Products ({data?.activeFeatured.length ?? 0})</h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-white/[0.05] max-h-[70vh] overflow-y-auto">
            {(data?.activeFeatured ?? []).map((f) => (
              <div key={f.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 font-mono truncate">Product: {f.productId}</p>
                  <p className="text-xs text-gray-400 font-mono truncate">Creator: {f.userId}</p>
                  {f.featuredUntil && <p className="text-xs text-gray-400">Until: {new Date(f.featuredUntil).toLocaleDateString("en-GB")}</p>}
                </div>
                <button onClick={() => doAction("unfeature", { productId: f.productId })}
                  className="text-xs text-red-400 hover:text-red-600 font-semibold flex-shrink-0">
                  Unfeature
                </button>
              </div>
            ))}
            {(data?.activeFeatured ?? []).length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">No active featured products</p>
            )}
          </div>
        </div>
      )}

      {/* Leaderboard tab */}
      {tab === "leaderboard" && (
        <div className="bg-white dark:bg-white/[0.04] border border-gray-100 dark:border-white/[0.08] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-white/[0.06]">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Creator Scores & Leaderboard Visibility</h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-white/[0.05] max-h-[70vh] overflow-y-auto">
            {(data?.topScores ?? []).map((s) => (
              <div key={s.userId} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 font-mono truncate">{s.userId}</p>
                  <p className="text-sm text-gray-900 dark:text-white">{s.level} · {s.salesCount} sales · £{s.revenueGbp.toFixed(0)} · ★{s.avgRating.toFixed(1)}</p>
                </div>
                <span className="text-sm font-black text-violet-600 dark:text-violet-400">{s.score}</span>
                <button
                  onClick={() => doAction("leaderboard-visibility", { targetUserId: s.userId, leaderboardOptIn: !s.leaderboardOptIn })}
                  className={`text-xs font-semibold px-2 py-1 rounded-lg ${s.leaderboardOptIn ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" : "bg-gray-100 dark:bg-white/[0.06] text-gray-500"}`}>
                  {s.leaderboardOptIn ? "Visible" : "Hidden"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
