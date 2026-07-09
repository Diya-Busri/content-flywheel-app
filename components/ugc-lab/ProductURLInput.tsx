"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Link2, X, Package, ChevronDown, ChevronUp } from "lucide-react";
import type { ScrapedProduct } from "@/app/api/ugc-lab/scrape-product/route";

type Props = {
  onProductScraped: (product: ScrapedProduct | null) => void;
  scrapedProduct: ScrapedProduct | null;
};

const PLATFORM_LABELS: Record<string, string> = {
  amazon: "Amazon",
  shopify: "Shopify",
  tiktok: "TikTok Shop",
  unknown: "Web",
};

const PLATFORM_COLORS: Record<string, string> = {
  amazon: "bg-orange-100 text-orange-700 border-orange-200",
  shopify: "bg-green-100 text-green-700 border-green-200",
  tiktok: "bg-pink-100 text-pink-700 border-pink-200",
  unknown: "bg-slate-100 text-slate-600 border-slate-200",
};

export function ProductURLInput({ onProductScraped, scrapedProduct }: Props) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const handleScrape = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ugc-lab/scrape-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scrape failed");
      onProductScraped(data.product as ScrapedProduct);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch product");
      onProductScraped(null);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setUrl("");
    setError(null);
    setShowDetails(false);
    onProductScraped(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading && url.trim()) handleScrape();
  };

  return (
    <Card className="flex-shrink-0">
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Link2 className="w-4 h-4" />
          Product URL
        </CardTitle>
        <CardDescription className="text-xs">
          Amazon, Shopify, or TikTok Shop — auto-scrapes title, images &amp; benefits
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="https://amazon.com/dp/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            className="text-xs h-8"
          />
          {scrapedProduct ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              className="h-8 px-2 flex-shrink-0"
            >
              <X className="w-3 h-3" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleScrape}
              disabled={loading || !url.trim()}
              className="h-8 px-3 flex-shrink-0"
            >
              {loading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                "Fetch"
              )}
            </Button>
          )}
        </div>

        {error && (
          <p className="text-xs text-red-500">⚠ {error}</p>
        )}

        {scrapedProduct && (
          <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-2 space-y-2">
            {/* Header row */}
            <div className="flex items-start gap-2">
              <Package className="w-3.5 h-3.5 mt-0.5 text-slate-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-tight line-clamp-2">
                  {scrapedProduct.title || "Product detected"}
                </p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${PLATFORM_COLORS[scrapedProduct.platform]}`}
                  >
                    {PLATFORM_LABELS[scrapedProduct.platform]}
                  </span>
                  {scrapedProduct.images.length > 0 && (
                    <span className="text-[10px] text-slate-500">
                      {scrapedProduct.images.length} image{scrapedProduct.images.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Image thumbnails */}
            {scrapedProduct.images.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                {scrapedProduct.images.slice(0, 5).map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={src}
                    alt=""
                    className="w-12 h-12 rounded object-cover flex-shrink-0 border border-slate-200 dark:border-slate-700 bg-slate-100"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ))}
              </div>
            )}

            {/* Toggle details */}
            <button
              className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              onClick={() => setShowDetails((v) => !v)}
            >
              {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showDetails ? "Hide details" : "Show benefits & audience"}
            </button>

            {showDetails && (
              <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-700">
                {scrapedProduct.description && (
                  <div>
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-0.5">Description</p>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-snug line-clamp-3">
                      {scrapedProduct.description}
                    </p>
                  </div>
                )}
                {scrapedProduct.keyBenefits.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">Key Benefits</p>
                    <div className="flex flex-wrap gap-1">
                      {scrapedProduct.keyBenefits.map((b, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px] py-0">
                          {b}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {scrapedProduct.targetAudience && (
                  <div>
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-0.5">Audience</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-snug">
                      {scrapedProduct.targetAudience}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
