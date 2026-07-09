"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sparkles, Trophy, Gift, ChevronRight, X, Clock,
  CheckCircle2, AlertCircle, TrendingUp, Users, Award, Zap,
  Copy, Check,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { REWARDS_CONFIG, CREATOR_LEVELS } from "@/lib/rewards-config";

type ReferralStatus =
  | "pending_signup" | "trial_active" | "product_published"
  | "pro_converted" | "credit_awarded" | "expired" | "rejected";

interface Referral {
  id: string;
  referredEmail: string | null;
  status: ReferralStatus;
  createdAt: string;
  convertedAt: string | null;
  creditAwardedAt: string | null;
}

interface CreditEvent {
  id: string;
  type: string;
  amountCredits: number;
  description: string;
  createdAt: string;
}

interface FeaturedSlot {
  productId: string;
  featuredUntil: string | null;
}

interface Summary {
  availableCredits: number;
  pendingReferrals: number;
  creditHistory: CreditEvent[];
  referrals: Referral[];
  activeFeatured: FeaturedSlot[];
  creatorLevel: string;
  salesCount: number;
  leaderboardOptIn: boolean;
}

interface Product { id: string; title: string }

const REFERRAL_STATUS_META: Record<ReferralStatus, { label: string; color: string }> = {
  pending_signup:    { label: "Pending signup",    color: "text-gray-400"   },
  trial_active:      { label: "Trial active",      color: "text-blue-400"   },
  product_published: { label: "Product published", color: "text-purple-400" },
  pro_converted:     { label: "Pro converted",     color: "text-orange-400" },
  credit_awarded:    { label: "Credit awarded ✓", color: "text-green-400"  },
  expired:           { label: "Expired",           color: "text-gray-500"   },
  rejected:          { label: "Rejected",          color: "text-red-400"    },
};

function WaysToEarnModal({ onClose }: { onClose: () => void }) {
  const ways = [
    { emoji: "👥", label: "Refer a creator who goes Pro",         credit: "+1 credit",     desc: "Awarded only after they pay their first invoice." },
    { emoji: "🛒", label: `Every ${REWARDS_CONFIG.SALES_PER_CREDIT} verified sales`,          credit: "+1 credit",     desc: "Based on completed native store orders." },
    { emoji: "💷", label: `Every £${REWARDS_CONFIG.REVENUE_PER_CREDIT_GBP} verified revenue`, credit: "+1 credit",     desc: "Cumulative GBP revenue from your native store." },
    { emoji: "🏆", label: "Product of the Week winner",           credit: "+2 credits",    desc: "Admin-awarded weekly prize." },
    { emoji: "⭐", label: `${REWARDS_CONFIG.REVIEWS_PER_CREDIT} five-star reviews`,           credit: "+1 credit",     desc: "Verified, approved product reviews." },
    { emoji: "✅", label: "Complete creator profile",              credit: "+0.25 credits", desc: "Name, bio, photo & brand colour all set." },
    { emoji: "🎯", label: "Community challenge completion",        credit: "+0.5 credits",  desc: "Complete admin-set community challenges." },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/10 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-white/8">
          <div>
            <h3 className="font-bold text-base text-gray-900 dark:text-white">Ways to Earn Featured Credits</h3>
            <p className="text-xs text-gray-500 mt-0.5">Real creator growth = real credits</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
          {ways.map((w) => (
            <div key={w.label} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.06]">
              <span className="text-xl flex-shrink-0">{w.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">{w.label}</p>
                  <span className="text-xs font-bold text-violet-600 dark:text-violet-400 flex-shrink-0">{w.credit}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{w.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-gray-100 dark:border-white/8">
          <p className="text-xs text-gray-500 text-center">1 credit = feature 1 product for {REWARDS_CONFIG.FEATURE_DURATION_DAYS} days</p>
        </div>
      </div>
    </div>
  );
}

function CreditHistoryModal({ history, onClose }: { history: CreditEvent[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/10 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-white/8">
          <h3 className="font-bold text-base text-gray-900 dark:text-white">Credit History</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={18} /></button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {history.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No credits yet — start earning!</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-white/[0.06]">
              {history.map((e) => (
                <div key={e.id} className="flex items-center justify-between px-5 py-3 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900 dark:text-white font-medium truncate">{e.description}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(e.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                  <span className={`text-sm font-bold flex-shrink-0 ${e.amountCredits >= 0 ? "text-green-500" : "text-red-400"}`}>
                    {e.amountCredits >= 0 ? "+" : ""}{e.amountCredits.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReferralsModal({ referrals, referralLink, onClose }: { referrals: Referral[]; referralLink: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copyLink = () => {
    navigator.clipboard.writeText(referralLink).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/10 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-white/8">
          <div>
            <h3 className="font-bold text-base text-gray-900 dark:text-white">Invite Creators</h3>
            <p className="text-xs text-gray-500 mt-0.5">1 credit per creator who becomes a paying Pro</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={18} /></button>
        </div>
        <div className="p-5">
          <div className="flex gap-2 mb-4">
            <input readOnly value={referralLink}
              className="flex-1 text-xs bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-gray-600 dark:text-gray-300 font-mono" />
            <button onClick={copyLink}
              className="px-3 py-2 rounded-lg bg-violet-600 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-violet-700 transition-colors">
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2 mb-4">
            ⚠️ Credits are only awarded after the referred creator pays their first invoice. Free trial sign-ups do not count.
          </p>
          <div className="max-h-52 overflow-y-auto space-y-2">
            {referrals.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No referrals yet</p>
            ) : referrals.map((r) => {
              const meta = REFERRAL_STATUS_META[r.status];
              return (
                <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 dark:bg-white/[0.03]">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{r.referredEmail ?? "Creator"}</p>
                    <p className={`text-xs ${meta.color}`}>{meta.label}</p>
                  </div>
                  <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

type LeaderboardTab = "top-sellers" | "highest-revenue" | "fastest-growing" | "highest-rated" | "most-followed";

interface LeaderboardEntry {
  rank: number; userId: string; displayName: string;
  profileImage: string | null; accentColor: string;
  levelLabel: string; levelEmoji: string;
  salesCount: number; revenueGbp: number;
  avgRating: number; followerCount: number; score: number;
}

const LB_TABS: { id: LeaderboardTab; label: string }[] = [
  { id: "top-sellers",     label: "Top Sellers" },
  { id: "highest-revenue", label: "Revenue"     },
  { id: "fastest-growing", label: "Growing"     },
  { id: "highest-rated",   label: "Rated"       },
  { id: "most-followed",   label: "Followed"    },
];

function LeaderboardPanel() {
  const [tab, setTab]       = useState<LeaderboardTab>("top-sellers");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/marketplace/leaderboard?tab=${tab}&limit=5`)
      .then((r) => r.json())
      .then((d) => setEntries(d.entries ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tab]);

  return (
    <div className="mt-5 pt-5 border-t border-gray-200 dark:border-white/[0.06]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy size={14} className="text-amber-500" />
          <span className="text-sm font-bold text-gray-900 dark:text-white">Leaderboard</span>
        </div>
      </div>
      <div className="flex gap-1 mb-3 flex-wrap">
        {LB_TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${tab === t.id ? "bg-violet-600 text-white" : "text-gray-500 dark:text-gray-400 hover:text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="py-4 text-center text-xs text-gray-400">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="py-4 text-center text-xs text-gray-400">No creators on this board yet — opt in to appear!</div>
      ) : (
        <div className="space-y-1.5">
          {entries.map((e) => (
            <a key={e.userId} href={`/c/${e.userId}`}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-white dark:hover:bg-white/[0.04] transition-colors group">
              <span className={`text-sm font-black w-5 text-center flex-shrink-0 ${e.rank === 1 ? "text-amber-500" : e.rank === 2 ? "text-gray-400" : e.rank === 3 ? "text-orange-400" : "text-gray-300"}`}>{e.rank}</span>
              {e.profileImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.profileImage} alt={e.displayName} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white" style={{ background: e.accentColor }}>
                  {e.displayName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 dark:text-white truncate group-hover:text-violet-600 transition-colors">{e.displayName}</p>
                <p className="text-xs text-gray-400">{e.levelEmoji} {e.levelLabel}</p>
              </div>
              <div className="text-right flex-shrink-0 text-xs font-bold text-gray-700 dark:text-gray-300">
                {tab === "top-sellers"     && `${e.salesCount} sales`}
                {tab === "highest-revenue" && `£${e.revenueGbp.toFixed(0)}`}
                {tab === "highest-rated"   && `★ ${e.avgRating.toFixed(1)}`}
                {(tab === "most-followed" || tab === "fastest-growing") && `${e.followerCount} followers`}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MarketplaceFeaturePanel() {
  const [summary, setSummary]   = useState<Summary | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState("");
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState<"earn" | "history" | "referrals" | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, prodRes] = await Promise.all([
        fetch("/api/rewards/summary").then((r) => r.json()),
        fetch("/api/products").then((r) => r.json()),
      ]);
      setSummary(sumRes as Summary);
      setProducts((prodRes.products ?? []) as Product[]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const referralLink = typeof window !== "undefined"
    ? `${window.location.origin}/signup?ref=me`
    : "";

  const handleFeature = async () => {
    if (!selectedId) return;
    setSaving(true); setMsg("");
    try {
      const res = await fetch("/api/marketplace/feature", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: selectedId }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setMsg(data.error ?? "Error"); return; }
      toast({ title: "✅ Product featured for 7 days!" });
      load();
    } catch { setMsg("Something went wrong."); }
    finally { setSaving(false); }
  };

  const handleRemove = async () => {
    await fetch("/api/marketplace/feature", { method: "DELETE" });
    toast({ title: "Featured placement removed." });
    load();
  };

  if (loading) return null;

  const credits      = summary?.availableCredits ?? 0;
  const level        = summary?.creatorLevel ?? "new";
  const levelMeta    = CREATOR_LEVELS.find((l) => l.id === level) ?? CREATOR_LEVELS[0];
  const featuredSlot = summary?.activeFeatured?.[0] ?? null;
  const featuredUntilDate = featuredSlot?.featuredUntil
    ? new Date(featuredSlot.featuredUntil).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    : null;

  const pendingCount = (summary?.referrals ?? []).filter((r) => !["credit_awarded","expired","rejected"].includes(r.status)).length;
  const earnedCount  = (summary?.referrals ?? []).filter((r) => r.status === "credit_awarded").length;

  return (
    <>
      {modal === "earn"      && <WaysToEarnModal onClose={() => setModal(null)} />}
      {modal === "history"   && <CreditHistoryModal history={summary?.creditHistory ?? []} onClose={() => setModal(null)} />}
      {modal === "referrals" && <ReferralsModal referrals={summary?.referrals ?? []} referralLink={referralLink} onClose={() => setModal(null)} />}

      <div className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/20 border border-violet-200 dark:border-violet-800/40 rounded-xl p-5 mb-6 mx-6 mt-6">

        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0">
            <Sparkles size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Creator Growth & Rewards</h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300">
                {levelMeta.emoji} {levelMeta.label}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Earn Featured Credits through real creator growth.{" "}
              <button onClick={() => setModal("earn")} className="text-violet-600 dark:text-violet-400 font-semibold hover:underline">Ways to earn →</button>
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <button onClick={() => setModal("history")}
            className="bg-white dark:bg-white/[0.04] border border-gray-100 dark:border-white/[0.08] rounded-xl p-3 text-left hover:border-violet-300 dark:hover:border-violet-600/40 transition-colors">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Available</p>
            <p className="text-lg font-black text-violet-600 dark:text-violet-400 leading-none">{credits % 1 === 0 ? credits.toFixed(0) : credits.toFixed(2)}</p>
            <p className="text-xs text-gray-400 mt-0.5">credits</p>
          </button>
          <button onClick={() => setModal("referrals")}
            className="bg-white dark:bg-white/[0.04] border border-gray-100 dark:border-white/[0.08] rounded-xl p-3 text-left hover:border-violet-300 dark:hover:border-violet-600/40 transition-colors">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Referrals</p>
            <p className="text-lg font-black text-gray-900 dark:text-white leading-none">{earnedCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">{pendingCount > 0 ? `+${pendingCount} pending` : "converted"}</p>
          </button>
          <div className="bg-white dark:bg-white/[0.04] border border-gray-100 dark:border-white/[0.08] rounded-xl p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Featured</p>
            <p className="text-lg font-black text-gray-900 dark:text-white leading-none">{featuredSlot ? "Active" : "—"}</p>
            {featuredUntilDate && <p className="text-xs text-gray-400 mt-0.5">until {featuredUntilDate}</p>}
          </div>
        </div>

        {/* Feature control */}
        {featuredSlot ? (
          <div className="flex items-center gap-3 flex-wrap p-3 bg-white dark:bg-white/[0.04] rounded-xl border border-gray-100 dark:border-white/[0.08]">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 animate-pulse" />
              <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                <strong>{products.find((p) => p.id === featuredSlot.productId)?.title ?? "Your product"}</strong>
                {featuredUntilDate && <span className="text-gray-400 ml-1">· until {featuredUntilDate}</span>}
              </span>
            </div>
            <button onClick={handleRemove} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
              <X size={12} /> Remove
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}
              className="flex-1 min-w-0 text-sm border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 bg-white dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-300 focus:outline-none focus:border-violet-400">
              <option value="">Choose a product to feature…</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            <button onClick={handleFeature} disabled={!selectedId || credits < 1 || saving}
              className="text-sm font-bold px-4 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0">
              {saving ? "Featuring…" : "Feature (1 credit)"}
            </button>
            {credits < 1 && (
              <button onClick={() => setModal("earn")} className="text-xs text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors">
                How to earn →
              </button>
            )}
          </div>
        )}

        {msg && <p className="text-xs mt-2 text-gray-500 dark:text-gray-400">{msg}</p>}

        {/* CTAs */}
        <div className="flex gap-2 mt-4 flex-wrap">
          <button onClick={() => setModal("earn")}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-violet-200 dark:border-violet-700/40 text-violet-700 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors">
            <Award size={12} /> View Rewards
          </button>
          <button onClick={() => setModal("referrals")}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors">
            <Users size={12} /> Invite Creator
          </button>
          <button onClick={() => setModal("history")}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors">
            <Gift size={12} /> Credit History
          </button>
        </div>

        <LeaderboardPanel />
      </div>
    </>
  );
}
