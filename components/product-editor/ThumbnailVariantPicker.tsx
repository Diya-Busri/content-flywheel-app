"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles, CheckCircle2, RefreshCw, Images } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type StyleOption = {
  id: string;
  label: string;
  emoji: string;
};

const STYLE_OPTIONS: StyleOption[] = [
  { id: "modern-gradient", label: "Modern Gradient", emoji: "🌈" },
  { id: "clean-minimal", label: "Clean Minimal", emoji: "⬜" },
  { id: "bold-dark", label: "Bold Dark", emoji: "🖤" },
  { id: "lifestyle", label: "Lifestyle", emoji: "✨" },
];

type Variant = {
  style: StyleOption;
  url: string | null;
  loading: boolean;
  error: string | null;
};

export function ThumbnailVariantPicker({
  productId,
  onSelect,
}: {
  productId: string;
  onSelect?: (url: string, style: string) => void;
}) {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [generating, setGenerating] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const { toast } = useToast();

  const generateVariants = async () => {
    setGenerating(true);
    setSelectedStyle(null);

    // Pick 3 styles (first 3 to keep cost manageable)
    const styles = STYLE_OPTIONS.slice(0, 3);

    // Initialise loading state
    setVariants(styles.map((style) => ({ style, url: null, loading: true, error: null })));

    // Fire all 3 in parallel
    await Promise.allSettled(
      styles.map(async (style, idx) => {
        try {
          const res = await fetch(`/api/products/${productId}/generate-thumbnail`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ style: style.id }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || "Failed");
          setVariants((prev) =>
            prev.map((v, i) => (i === idx ? { ...v, url: data.thumbnailUrl ?? data.url ?? null, loading: false } : v))
          );
        } catch (err) {
          setVariants((prev) =>
            prev.map((v, i) =>
              i === idx ? { ...v, error: err instanceof Error ? err.message : "Failed", loading: false } : v
            )
          );
        }
      })
    );

    setGenerating(false);
  };

  const handleSelect = (variant: Variant) => {
    if (!variant.url) return;
    setSelectedStyle(variant.style.id);
    onSelect?.(variant.url, variant.style.id);
    toast({ title: `${variant.style.label} thumbnail selected!` });
  };

  const anyLoading = variants.some((v) => v.loading);

  return (
    <Card className="border-gray-200 dark:border-gray-800">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Images className="w-4 h-4 text-orange-500" />
            <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white">Thumbnail Variants</CardTitle>
          </div>
          <Button
            size="sm"
            variant={variants.length > 0 ? "ghost" : "outline"}
            className="h-7 gap-1.5 text-xs border-gray-200"
            onClick={generateVariants}
            disabled={generating || anyLoading}
            type="button"
          >
            {generating || anyLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : variants.length > 0 ? (
              <RefreshCw className="w-3 h-3" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            {generating || anyLoading
              ? "Generating…"
              : variants.length > 0
              ? "Regenerate"
              : "Generate 3 Variants"}
          </Button>
        </div>
        {variants.length === 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Generate 3 different thumbnail styles at once — pick the best one to use.
          </p>
        )}
      </CardHeader>

      {variants.length > 0 && (
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-3 gap-3">
            {variants.map((variant) => (
              <div key={variant.style.id} className="space-y-2">
                <div
                  className={`relative aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all ${
                    selectedStyle === variant.style.id
                      ? "border-green-500 ring-2 ring-green-500/30"
                      : variant.url
                      ? "border-gray-200 dark:border-gray-700 hover:border-orange-400 cursor-pointer"
                      : "border-gray-100 dark:border-gray-800"
                  }`}
                  onClick={() => variant.url && handleSelect(variant)}
                >
                  {variant.loading && (
                    <div className="absolute inset-0 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                      <div className="space-y-2 text-center">
                        <Loader2 className="w-5 h-5 animate-spin text-orange-400 mx-auto" />
                        <p className="text-xs text-gray-400">{variant.style.emoji}</p>
                      </div>
                    </div>
                  )}
                  {variant.error && !variant.loading && (
                    <div className="absolute inset-0 bg-red-50 dark:bg-red-950/20 flex items-center justify-center p-2">
                      <p className="text-xs text-red-500 text-center">Failed</p>
                    </div>
                  )}
                  {variant.url && !variant.loading && (
                    <>
                      <img
                        src={variant.url}
                        alt={variant.style.label}
                        className="w-full h-full object-cover"
                      />
                      {selectedStyle === variant.style.id && (
                        <div className="absolute top-1 right-1">
                          <CheckCircle2 className="w-5 h-5 text-green-500 drop-shadow" />
                        </div>
                      )}
                    </>
                  )}
                </div>
                <p className="text-xs text-center text-gray-600 dark:text-gray-400 font-medium">
                  {variant.style.emoji} {variant.style.label}
                </p>
                {variant.url && selectedStyle !== variant.style.id && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full h-6 text-xs border-gray-200"
                    onClick={() => handleSelect(variant)}
                  >
                    Use this
                  </Button>
                )}
                {selectedStyle === variant.style.id && (
                  <p className="text-xs text-center text-green-600 dark:text-green-400 font-medium">✓ Selected</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
