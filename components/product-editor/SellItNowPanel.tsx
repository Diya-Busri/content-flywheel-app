"use client";

import { useState } from "react";
import { Copy, Check, ExternalLink, Loader2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";

type Platform = {
  id: string;
  label: string;
  emoji: string;
  url: string;
  color: string;
};

const PLATFORMS: Platform[] = [
  { id: "gumroad",    label: "Gumroad",    emoji: "🛒", url: "https://gumroad.com/products/new",        color: "bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100 dark:bg-pink-900/20 dark:text-pink-300 dark:border-pink-800/40" },
  { id: "etsy",       label: "Etsy",       emoji: "🏪", url: "https://www.etsy.com/sell",                color: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800/40" },
  { id: "stan-store", label: "Stan Store", emoji: "⚡", url: "https://stan.store",                       color: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800/40" },
  { id: "beacons",    label: "Beacons",    emoji: "🔮", url: "https://beacons.ai",                       color: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/40" },
  { id: "payhip",     label: "Payhip",     emoji: "💳", url: "https://payhip.com/dashboard/product/new", color: "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100 dark:bg-teal-900/20 dark:text-teal-300 dark:border-teal-800/40" },
];

type SellItNowPanelProps = {
  productId: string;
};

/**
 * Platform-specific listing copy panel. Pick a platform → AI generates formatted
 * copy → one-click copy to clipboard → open the platform to paste & publish.
 */
export function SellItNowPanel({ productId }: SellItNowPanelProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [copy, setCopy] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handlePlatformClick = async (platform: Platform) => {
    if (selectedPlatform === platform.id && copy) return; // already loaded
    setSelectedPlatform(platform.id);
    setCopy("");
    setCopied(false);
    setLoading(true);
    try {
      const res = await fetch(`/api/products/${productId}/platform-copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: platform.id }),
      });
      const data = await res.json();
      setCopy(data.copy ?? "Failed to generate copy.");
    } catch {
      setCopy("Failed to generate copy. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!copy) return;
    try {
      await navigator.clipboard.writeText(copy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const activePlatform = PLATFORMS.find((p) => p.id === selectedPlatform);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
        <ShoppingBag className="w-4 h-4 text-orange-500 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Sell It Now</p>
          <p className="text-xs text-gray-500">Pick a platform — get copy ready to paste</p>
        </div>
      </div>

      {/* Platform picker */}
      <div className="p-3 flex flex-wrap gap-1.5">
        {PLATFORMS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => handlePlatformClick(p)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${p.color} ${selectedPlatform === p.id ? "ring-2 ring-offset-1 ring-orange-400" : ""}`}
          >
            <span>{p.emoji}</span>
            {p.label}
          </button>
        ))}
      </div>

      {/* Copy output */}
      {selectedPlatform && (
        <div className="px-3 pb-3 space-y-2 border-t border-gray-100 dark:border-gray-800 pt-3">
          {loading ? (
            <div className="flex items-center gap-2 py-4 justify-center text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">Writing {activePlatform?.label} listing copy…</span>
            </div>
          ) : copy ? (
            <>
              <textarea
                readOnly
                value={copy}
                className="w-full text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-gray-700 rounded-lg p-3 resize-none min-h-[140px] font-mono leading-relaxed focus:outline-none"
                rows={8}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleCopy}
                  className={`flex-1 gap-1.5 text-xs ${copied ? "bg-green-500 hover:bg-green-600" : "bg-orange-500 hover:bg-orange-600"}`}
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied!" : `Copy for ${activePlatform?.label}`}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  asChild
                  className="gap-1 text-xs border-gray-200"
                >
                  <a href={activePlatform?.url} target="_blank" rel="noopener noreferrer">
                    Open {activePlatform?.label} <ExternalLink className="w-3 h-3" />
                  </a>
                </Button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
