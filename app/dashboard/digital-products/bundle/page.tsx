"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Package2, Sparkles, Copy, CheckCircle2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type Product = {
  id: string;
  title: string;
  niche: string;
  format: string;
  thumbnail?: string | null;
};

type BundleCopy = {
  bundleName: string;
  tagline: string;
  description: string;
  priceRange: string;
  savings: string;
  bullets: string[];
  platforms: { gumroad?: string; etsy?: string };
};

function formatLabel(format: string) {
  return format.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function BundleCreatorPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [bundleCopy, setBundleCopy] = useState<BundleCopy | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/library?type=product&limit=30")
      .then((r) => r.json())
      .then((data) => {
        const items = (data.items ?? data.products ?? []) as Product[];
        setProducts(items);
      })
      .catch(() => {})
      .finally(() => setLoadingProducts(false));
  }, []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 5) next.add(id);
      else toast({ title: "Max 5 products per bundle", variant: "destructive" });
      return next;
    });
  };

  const generate = async () => {
    if (selected.size < 2) {
      toast({ title: "Select at least 2 products", variant: "destructive" });
      return;
    }
    setGenerating(true);
    setBundleCopy(null);
    try {
      const res = await fetch("/api/products/bundle-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: Array.from(selected) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      setBundleCopy(data as BundleCopy);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast({ title: `${label} copied!` }));
  };

  const selectedProducts = products.filter((p) => selected.has(p.id));

  return (
    <main className="p-6 md:p-10 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/dashboard/digital-products">
          <Button variant="ghost" size="sm" className="gap-1.5 text-gray-500">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bundle Creator</h1>
          <p className="text-sm text-gray-500 mt-0.5">Package 2–5 products into a bundle with AI-generated copy and pricing.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Product Picker */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Select products ({selected.size}/5)</h2>
            {selected.size >= 2 && (
              <Button
                size="sm"
                className="h-8 gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs"
                onClick={generate}
                disabled={generating}
              >
                {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {generating ? "Generating…" : "Generate Bundle Copy"}
              </Button>
            )}
          </div>

          {loadingProducts ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : products.length === 0 ? (
            <Card className="border-dashed border-gray-200 dark:border-gray-700">
              <CardContent className="py-12 text-center">
                <Package2 className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No products yet.</p>
                <Link href="/dashboard/digital-products/create">
                  <Button size="sm" variant="outline" className="mt-3">Create a product</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {products.map((p) => {
                const isSelected = selected.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.id)}
                    className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                      isSelected
                        ? "border-orange-400 bg-orange-50/60 dark:border-orange-500/50 dark:bg-orange-950/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      isSelected ? "border-orange-500 bg-orange-500" : "border-gray-300 dark:border-gray-600"
                    }`}>
                      {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{formatLabel(p.format)} · {p.niche}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {selected.size >= 2 && (
            <p className="text-xs text-gray-400 mt-2 text-center">
              {selected.size} product{selected.size !== 1 ? "s" : ""} selected
            </p>
          )}
          {selected.size < 2 && products.length > 0 && (
            <p className="text-xs text-gray-400 mt-2 text-center">Select at least 2 products to continue</p>
          )}
        </div>

        {/* Bundle Copy Output */}
        <div>
          {!bundleCopy && !generating && (
            <div className="flex flex-col items-center justify-center h-64 text-center rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
              <Package2 className="w-8 h-8 text-gray-300 mb-3" />
              <p className="text-sm text-gray-400">Select products and generate bundle copy</p>
            </div>
          )}

          {generating && (
            <div className="flex flex-col items-center justify-center h-64">
              <Loader2 className="w-6 h-6 animate-spin text-orange-500 mb-3" />
              <p className="text-sm text-gray-500">Crafting your bundle…</p>
            </div>
          )}

          {bundleCopy && !generating && (
            <div className="space-y-4">
              {/* Bundle name & tagline */}
              <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50/60 dark:border-orange-900/40 dark:from-orange-950/20 dark:to-amber-950/10">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{bundleCopy.bundleName}</p>
                      <p className="text-sm text-orange-600 dark:text-orange-400 mt-0.5 italic">{bundleCopy.tagline}</p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0"
                      onClick={() => copy(`${bundleCopy.bundleName}\n${bundleCopy.tagline}`, "Bundle name")}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0 text-xs">
                      💰 {bundleCopy.priceRange}
                    </Badge>
                    {bundleCopy.savings && (
                      <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0 text-xs">
                        🏷️ {bundleCopy.savings}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Description */}
              <Card className="border-gray-200 dark:border-gray-800">
                <CardHeader className="pb-2 pt-3 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-semibold text-gray-700 dark:text-gray-300">Sales Description</CardTitle>
                    <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0"
                      onClick={() => copy(bundleCopy.description, "Description")}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{bundleCopy.description}</p>
                  {bundleCopy.bullets?.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {bundleCopy.bullets.map((b, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <span className="text-orange-500 mt-0.5">✓</span> {b}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              {/* Platform copy */}
              {bundleCopy.platforms && Object.entries(bundleCopy.platforms).map(([platform, text]) => (
                text && (
                  <Card key={platform} className="border-gray-200 dark:border-gray-800">
                    <CardHeader className="pb-2 pt-3 px-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xs font-semibold text-gray-700 dark:text-gray-300 capitalize">
                          {platform} listing
                        </CardTitle>
                        <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0"
                          onClick={() => copy(text, `${platform} listing`)}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{text}</p>
                    </CardContent>
                  </Card>
                )
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs gap-1.5"
                onClick={generate}
                disabled={generating}
              >
                <Sparkles className="w-3 h-3" /> Regenerate
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
