"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Film, Sparkles, CheckCircle2, Zap, ShoppingBag, TrendingDown, History } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { VIDEO_CREDIT_PACKS } from "@/lib/video-credits";

type Transaction = {
  id: string;
  type: "purchase" | "usage";
  amount: number;
  description: string;
  createdAt: string;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function VideoCreditsContent() {
  const searchParams = useSearchParams();
  const [balance, setBalance] = useState<number | null>(null);
  const [history, setHistory] = useState<{ transactions: Transaction[]; totalPurchased: number; totalUsed: number } | null>(null);
  const [loadingPackId, setLoadingPackId] = useState<string | null>(null);
  const { toast } = useToast();

  const justPurchased = searchParams.get("success") === "1";
  const creditsAdded = searchParams.get("credits");

  useEffect(() => {
    if (justPurchased && creditsAdded) {
      toast({
        title: `🎉 ${creditsAdded} video credits added!`,
        description: "Your credits are ready to use. Start generating videos.",
      });
    }
  }, [justPurchased, creditsAdded, toast]);

  useEffect(() => {
    fetch("/api/video-credits/balance")
      .then((r) => r.ok ? r.json() : null)
      .then((data: { balance?: number } | null) => setBalance(data?.balance ?? 0))
      .catch(() => setBalance(0));

    fetch("/api/video-credits/history")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setHistory(data))
      .catch(() => {});
  }, []);

  const handleBuy = async (packId: string) => {
    setLoadingPackId(packId);
    try {
      const res = await fetch("/api/video-credits/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({ title: "Payment error", description: data.error ?? "Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" });
    } finally {
      setLoadingPackId(null);
    }
  };

  const showTracker = history && (history.totalPurchased > 0 || history.transactions.length > 0);
  const usedPct = history && history.totalPurchased > 0
    ? Math.min(100, Math.round((history.totalUsed / history.totalPurchased) * 100))
    : 0;

  return (
    <main className="p-6 md:p-10 max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-xs font-semibold uppercase tracking-wide mb-3">
          <Film className="w-3 h-3" /> Video Credits
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Generate AI Videos</h1>
        <p className="text-gray-500 dark:text-gray-400 text-base leading-relaxed">
          Buy credits to generate full AI videos — brand story videos, cooking videos, and more. Credits never expire.
        </p>
      </div>

      {/* Current balance */}
      <div className="flex items-center gap-4 p-5 rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] mb-6">
        <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
          <Sparkles className="w-6 h-6 text-orange-500" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-gray-500 dark:text-gray-400">Your video credit balance</p>
          {balance === null ? (
            <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-0.5" />
          ) : (
            <p className="text-3xl font-bold text-gray-900 dark:text-white leading-tight">
              {balance} <span className="text-base font-normal text-gray-500 dark:text-gray-400">{balance === 1 ? "credit" : "credits"}</span>
            </p>
          )}
        </div>
        {balance !== null && balance > 0 && (
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-400 dark:text-gray-500">Ready to use</p>
            <div className="flex items-center gap-1 text-green-500 text-sm font-semibold mt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Active
            </div>
          </div>
        )}
      </div>

      {/* Credit tracker — only shown after first purchase */}
      {showTracker && (
        <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] mb-6 overflow-hidden">
          {/* Stats row */}
          <div className="grid grid-cols-3 divide-x divide-[#E5E7EB] dark:divide-[#2A2A2A]">
            <div className="p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-orange-500 mb-1.5">
                <ShoppingBag className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold uppercase tracking-wide">Purchased</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{history!.totalPurchased}</p>
              <p className="text-xs text-gray-400 mt-0.5">all time</p>
            </div>
            <div className="p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-blue-500 mb-1.5">
                <TrendingDown className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold uppercase tracking-wide">Used</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{history!.totalUsed}</p>
              <p className="text-xs text-gray-400 mt-0.5">videos generated</p>
            </div>
            <div className="p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-green-500 mb-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold uppercase tracking-wide">Remaining</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{balance ?? "—"}</p>
              <p className="text-xs text-gray-400 mt-0.5">credits left</p>
            </div>
          </div>

          {/* Progress bar */}
          {history!.totalPurchased > 0 && (
            <div className="px-4 pb-4">
              <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                <span>{usedPct}% used</span>
                <span>{100 - usedPct}% remaining</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 dark:bg-[#2A2A2A] overflow-hidden">
                <div
                  className="h-full rounded-full bg-orange-500 transition-all duration-700"
                  style={{ width: `${usedPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Recent activity */}
          {history!.transactions.length > 0 && (
            <div className="border-t border-[#E5E7EB] dark:border-[#2A2A2A]">
              <div className="flex items-center gap-2 px-4 py-3">
                <History className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Recent activity</span>
              </div>
              <ul className="divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A]">
                {history!.transactions.slice(0, 8).map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      t.type === "purchase"
                        ? "bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400"
                        : "bg-orange-100 dark:bg-orange-950/40 text-orange-500"
                    }`}>
                      {t.type === "purchase" ? (
                        <ShoppingBag className="w-3.5 h-3.5" />
                      ) : (
                        <Film className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white font-medium truncate">{t.description}</p>
                      <p className="text-xs text-gray-400">{timeAgo(t.createdAt)}</p>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ${
                      t.type === "purchase" ? "text-green-600 dark:text-green-400" : "text-orange-500"
                    }`}>
                      {t.type === "purchase" ? `+${t.amount}` : `-${t.amount}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* How it works */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        {[
          { icon: "1️⃣", title: "Buy credits", desc: "Pick a pack below — one-time payment, no subscription" },
          { icon: "2️⃣", title: "Generate a video", desc: "Use Template Studio → Brand Story Video, Cooking, or Avatar" },
          { icon: "3️⃣", title: "1 credit per video", desc: "Each full video costs 1 credit. Credits never expire." },
        ].map((step) => (
          <div key={step.title} className="p-4 rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] text-center">
            <p className="text-2xl mb-2">{step.icon}</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{step.title}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{step.desc}</p>
          </div>
        ))}
      </div>

      {/* Credit packs */}
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Choose a pack</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {VIDEO_CREDIT_PACKS.map((pack) => (
          <div
            key={pack.id}
            className={`relative rounded-xl border p-5 flex flex-col gap-3 transition-all ${
              pack.popular
                ? "border-orange-400 dark:border-orange-500 bg-orange-50/50 dark:bg-orange-950/20 shadow-sm shadow-orange-100 dark:shadow-none"
                : "border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]"
            }`}
          >
            {pack.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-orange-500 text-white text-[11px] font-bold uppercase tracking-wide">
                  <Zap className="w-2.5 h-2.5" /> Most popular
                </span>
              </div>
            )}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">{pack.label}</span>
                {pack.saving && (
                  <span className="text-[11px] font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-1.5 py-0.5 rounded">
                    {pack.saving}
                  </span>
                )}
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {pack.credits}
                <span className="text-base font-normal text-gray-500 dark:text-gray-400 ml-1">videos</span>
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                £{(pack.priceGbp / pack.credits).toFixed(2)} per video
              </p>
            </div>
            <div className="flex items-end justify-between gap-2 mt-auto">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                £{pack.priceGbp.toFixed(2)}
              </p>
              <Button
                size="sm"
                onClick={() => void handleBuy(pack.id)}
                disabled={loadingPackId !== null}
                className={`gap-1.5 ${pack.popular ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}`}
                variant={pack.popular ? "default" : "outline"}
              >
                {loadingPackId === pack.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : null}
                {loadingPackId === pack.id ? "Loading…" : "Buy now"}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <p className="text-xs text-gray-400 dark:text-gray-600 text-center mt-6 leading-relaxed">
        Payments are processed securely by Stripe. Credits are added to your account instantly after purchase.
        <br />Video generation uses AI models from fal.ai, DALL·E, and ElevenLabs.
      </p>
    </main>
  );
}

export default function VideoCreditsPage() {
  return (
    <Suspense fallback={
      <main className="p-6 md:p-10 flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      </main>
    }>
      <VideoCreditsContent />
    </Suspense>
  );
}
