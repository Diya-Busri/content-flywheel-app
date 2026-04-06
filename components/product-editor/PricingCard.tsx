"use client";

import { useState } from "react";
import { Loader2, DollarSign, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type PricingResult = {
  priceRange: string;
  strategy: string;
  reasoning: string;
};

type PricingCardProps = {
  productId: string;
};

/**
 * AI pricing recommendation card for the marketing tab.
 * Calls /api/products/[id]/pricing-recommendation to get a price range,
 * strategy (one-time vs tiered), and one-sentence reasoning.
 */
export function PricingCard({ productId }: PricingCardProps) {
  const [result, setResult] = useState<PricingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPricing = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/products/${productId}/pricing-recommendation`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setResult({
        priceRange: data.priceRange,
        strategy: data.strategy,
        reasoning: data.reasoning,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-green-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Pricing Strategy</p>
            <p className="text-xs text-gray-500">AI-recommended price for this product</p>
          </div>
        </div>
        {result && (
          <Button
            size="sm"
            variant="ghost"
            onClick={fetchPricing}
            disabled={loading}
            className="h-7 px-2 text-gray-400 hover:text-gray-600"
            title="Recalculate"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        )}
      </div>

      <div className="p-4">
        {!result && !loading && (
          <div className="text-center py-2 space-y-3">
            <p className="text-xs text-gray-500">Not sure what to charge? Get an AI pricing recommendation based on your product, niche, and format.</p>
            <Button
              size="sm"
              onClick={fetchPricing}
              className="w-full bg-green-500 hover:bg-green-600 text-white gap-2"
            >
              <DollarSign className="w-3.5 h-3.5" />
              Get pricing recommendation
            </Button>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-4 text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">Analysing your product…</span>
          </div>
        )}

        {error && (
          <div className="text-xs text-red-500 text-center py-2">{error}</div>
        )}

        {result && (
          <div className="space-y-3">
            {/* Price range — big prominent number */}
            <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 rounded-lg px-4 py-3">
              <div>
                <p className="text-xs text-green-600 dark:text-green-400 font-medium">Recommended price</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">{result.priceRange}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-green-600 dark:text-green-400 font-medium">Strategy</p>
                <p className="text-sm font-semibold text-green-700 dark:text-green-300">{result.strategy}</p>
              </div>
            </div>
            {/* Reasoning */}
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed italic">
              "{result.reasoning}"
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
